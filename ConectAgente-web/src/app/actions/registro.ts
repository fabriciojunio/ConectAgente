'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rateLimit';
import { decidirSegundoFator } from '@/lib/segundoFator';
import { z } from 'zod';
import { registrarAcao } from '@/services/auditService';

// ---------------------------------------------------------------------------
// Schema de validação para o formulário de registro
// ---------------------------------------------------------------------------
const registroSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos'),
  telefone: z.string().optional(),
  // Tem que casar com o CHECK de solicitacoes_registro.cargo_pretendido.
  cargo_pretendido: z.enum(['coordenador', 'gerente', 'outro'], {
    error: 'Selecione um cargo válido',
  }),
  cargo_outro: z.string().optional(),
  unidade_saude: z.string().min(2, 'Informe a unidade de saúde'),
  area_atuacao: z.string().min(2, 'Informe a área de atuação'),
  justificativa: z.string().min(10, 'Justificativa deve ter pelo menos 10 caracteres').max(500),
  senha: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minuscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um numero')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter pelo menos um caractere especial'),
});

// ---------------------------------------------------------------------------
// Criar solicitação de registro (público, sem autenticação)
// ---------------------------------------------------------------------------
export async function criarSolicitacao(formData: {
  nome: string;
  cpf: string;
  telefone?: string;
  cargo_pretendido: 'coordenador' | 'gerente' | 'outro';
  cargo_outro?: string;
  unidade_saude: string;
  area_atuacao: string;
  justificativa: string;
  senha: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Rate limit: 5 registration attempts per minute per IP
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = await rateLimit(`registro:${ip}`, 5, 60_000);
    if (!allowed) {
      return { success: false, error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' };
    }

    const parsed = registroSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const admin = createAdminClient();

    // Verificar se CPF já existe como agente
    const { data: existingAgente } = await admin
      .from('agentes')
      .select('id')
      .eq('cpf', parsed.data.cpf)
      .maybeSingle();

    if (existingAgente) {
      return { success: false, error: 'Este CPF já possui uma conta no sistema.' };
    }

    // Verificar se já existe uma solicitação pendente com este CPF
    const { data: existingSolicitacao } = await admin
      .from('solicitacoes_registro')
      .select('id, status')
      .eq('cpf', parsed.data.cpf)
      .in('status', ['pendente'])
      .maybeSingle();

    if (existingSolicitacao) {
      return { success: false, error: 'Já existe uma solicitação pendente para este CPF.' };
    }

    // Validar campo "outro"
    if (parsed.data.cargo_pretendido === 'outro' && !parsed.data.cargo_outro?.trim()) {
      return { success: false, error: 'Informe qual cargo pretendido.' };
    }

    // Inserir solicitação (sem criar conta ainda)
    const { error: insertError } = await admin
      .from('solicitacoes_registro')
      .insert({
        nome: parsed.data.nome,
        cpf: parsed.data.cpf,
        telefone: parsed.data.telefone || null,
        cargo_pretendido: parsed.data.cargo_pretendido,
        cargo_outro: parsed.data.cargo_pretendido === 'outro'
          ? parsed.data.cargo_outro!.trim()
          : null,
        unidade_saude: parsed.data.unidade_saude,
        area_atuacao: parsed.data.area_atuacao,
        justificativa: parsed.data.justificativa,
        status: 'pendente',
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: 'Este CPF já foi registrado anteriormente.' };
      }
      throw insertError;
    }

    return { success: true };
  } catch (err) {
    console.error('Erro ao criar solicitação:', err);
    return { success: false, error: 'Erro interno. Tente novamente mais tarde.' };
  }
}


// ---------------------------------------------------------------------------
// Quem pode aprovar ou rejeitar cadastro
// ---------------------------------------------------------------------------
/**
 * Confirma que quem chamou esta autenticado e tem papel de gerente ou admin.
 *
 * Isto nao existia, e a falta era grave. Server Action em Next.js e um
 * endpoint HTTP alcancavel de fora. As duas funcoes abaixo recebiam o id do
 * aprovador como parametro, confiavam nele, e usavam o cliente de servico,
 * que ignora o RLS por definicao. O caminho de ataque era direto:
 *
 *   1. preencher o cadastro publico escolhendo cargo "gerente"
 *   2. chamar `aprovarSolicitacao` com o id da propria solicitacao e
 *      qualquer uuid como aprovador
 *   3. receber usuario de autenticacao e linha em `agentes` com
 *      role = 'gerente'
 *   4. entrar no painel e ler o prontuario de todo mundo, mais a trilha
 *      de auditoria
 *
 * Nenhuma credencial era necessaria. O limite de taxa que existia nao
 * ajudava: ele contava por `aprovadorId`, que o proprio atacante escolhia.
 *
 * A identidade agora vem do cookie de sessao, nunca do parametro. O papel e
 * conferido com a mesma regra da policy `audit_log_select` do banco: gerente
 * e admin.
 */
async function exigirAprovador(): Promise<
  { ok: true; aprovadorId: string } | { ok: false; erro: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, erro: 'Sessao nao encontrada. Entre no painel novamente.' };
  }

  // Aprovar cadastro e trocar senha usam a chave de serviço, que passa por
  // cima de todo o RLS. Não basta o middleware exigir o segundo fator nas
  // páginas: a ação é um endpoint por si, e confere de novo aqui.
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (decidirSegundoFator(nivel) !== 'liberado') {
    return { ok: false, erro: 'Confirme o código do autenticador para continuar.' };
  }

  const admin = createAdminClient();
  const { data: aprovador } = await admin
    .from('agentes')
    .select('role, ativo')
    .eq('id', user.id)
    .maybeSingle();

  if (!aprovador || aprovador.ativo === false) {
    return { ok: false, erro: 'Conta sem acesso ao painel.' };
  }

  if (!['gerente', 'admin'].includes(aprovador.role)) {
    return { ok: false, erro: 'Apenas gerentes e administradores aprovam cadastros.' };
  }

  return { ok: true, aprovadorId: user.id };
}

// ---------------------------------------------------------------------------
// Aprovar solicitação (requer admin/gerente autenticado)
// ---------------------------------------------------------------------------
export async function aprovarSolicitacao(
  solicitacaoId: string,
  senha: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // O id do aprovador sai da sessao, nao do parametro. Confiar no parametro
    // era o que permitia aprovar cadastro sem credencial nenhuma.
    const autorizacao = await exigirAprovador();
    if (!autorizacao.ok) {
      return { success: false, error: autorizacao.erro };
    }
    const aprovadorId = autorizacao.aprovadorId;

    // Limite de taxa por aprovador de verdade, agora que ele e confiavel.
    const { allowed } = await rateLimit(`aprovar:${aprovadorId}`, 10, 60_000);
    if (!allowed) {
      return { success: false, error: 'Muitas tentativas. Aguarde um minuto.' };
    }

    const admin = createAdminClient();

    // Buscar solicitação
    const { data: solicitacao, error: fetchError } = await admin
      .from('solicitacoes_registro')
      .select('*')
      .eq('id', solicitacaoId)
      .eq('status', 'pendente')
      .single();

    if (fetchError || !solicitacao) {
      return { success: false, error: 'Solicitação não encontrada ou já processada.' };
    }

    // Criar usuário no Supabase Auth
    const email = `${solicitacao.cpf}@conectagente.local`;
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return { success: false, error: 'Este e-mail já está registrado no sistema de autenticação.' };
      }
      throw authError;
    }

    if (!authUser.user) {
      return { success: false, error: 'Erro ao criar usuário de autenticação.' };
    }

    // Criar entrada na tabela agentes
    const { error: agenteError } = await admin
      .from('agentes')
      .insert({
        id: authUser.user.id,
        nome: solicitacao.nome,
        cpf: solicitacao.cpf,
        email,
        telefone: solicitacao.telefone,
        area_atuacao: solicitacao.area_atuacao,
        unidade_saude: solicitacao.unidade_saude,
        // O papel precisa ser um dos quatro que o CHECK de agentes.role
        // aceita: agente, coordenador, gerente ou admin. O codigo anterior
        // gravava 'supervisor', que nao esta na lista, e toda aprovacao
        // falhava com:
        //   new row for relation "agentes" violates check constraint
        //   "agentes_role_check"
        // 'outro' vira 'agente', que e o menor privilegio; quem pediu
        // coordenador ou gerente recebe o papel pedido. Admin continua
        // fora: so outro admin concede.
        role: solicitacao.cargo_pretendido === 'coordenador' ? 'coordenador'
            : solicitacao.cargo_pretendido === 'gerente' ? 'gerente'
            : 'agente',
        ativo: true,
      });

    if (agenteError) {
      // Rollback: deletar usuário auth criado
      await admin.auth.admin.deleteUser(authUser.user.id);
      throw agenteError;
    }

    // Atualizar solicitação como aprovada
    await admin
      .from('solicitacoes_registro')
      .update({
        status: 'aprovado',
        aprovado_por: aprovadorId,
        aprovado_em: new Date().toISOString(),
      })
      .eq('id', solicitacaoId);

    // Aprovar um cadastro cria acesso ao prontuário de munícipes. É ato
    // administrativo e precisa de rastro: quem aprovou, quando, qual
    // solicitação. Não guarda dado pessoal do solicitante.
    await registrarAcao('APROVAR_CADASTRO', 'solicitacoes_registro', solicitacaoId, undefined, {
      aprovado_por: aprovadorId,
    });

    return { success: true };
  } catch (err) {
    console.error('Erro ao aprovar solicitação:', err);
    return { success: false, error: 'Erro interno ao aprovar solicitação.' };
  }
}

// ---------------------------------------------------------------------------
// Redefinir a senha de sincronização de um agente
// ---------------------------------------------------------------------------

/** Mesma regra de senha do cadastro. */
const senhaDeAcessoSchema = registroSchema.shape.senha;

/**
 * Papéis cuja senha cada aprovador pode redefinir.
 *
 * Só para baixo na hierarquia. Se um gerente pudesse redefinir a senha de
 * outro gerente ou de um admin, entraria na conta dele: seria elevação de
 * privilégio com um clique.
 */
const PODE_REDEFINIR: Record<string, string[]> = {
  gerente: ['agente', 'coordenador'],
  admin: ['agente', 'coordenador', 'gerente'],
};

/**
 * Redefine a senha que o aplicativo usa para sincronizar.
 *
 * Por que existe. A recuperação de senha do aplicativo é local: troca a senha
 * de entrar no aparelho com o código de recuperação, sem servidor. A conta do
 * agente no Supabase Auth usa um e-mail interno (`<cpf>@conectagente.local`),
 * que não recebe mensagem, então não há "esqueci a senha" do lado do
 * servidor. Sem esta ação, o agente que recuperava a senha ficava com a
 * sincronização parada para sempre. O aplicativo avisa e manda procurar a
 * coordenação; é aqui que a coordenação resolve.
 */
export async function redefinirSenhaDeAcesso(
  agenteId: string,
  novaSenha: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const autorizacao = await exigirAprovador();
    if (!autorizacao.ok) {
      return { success: false, error: autorizacao.erro };
    }
    const aprovadorId = autorizacao.aprovadorId;

    if (agenteId === aprovadorId) {
      return { success: false, error: 'Para trocar a sua própria senha, use a sua conta.' };
    }

    const parsed = senhaDeAcessoSchema.safeParse(novaSenha);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { allowed } = await rateLimit(`senha:${aprovadorId}`, 10, 60_000);
    if (!allowed) {
      return { success: false, error: 'Muitas tentativas. Aguarde um minuto.' };
    }

    const admin = createAdminClient();
    const [{ data: aprovador }, { data: alvo }] = await Promise.all([
      admin.from('agentes').select('role').eq('id', aprovadorId).maybeSingle(),
      admin.from('agentes').select('role, ativo').eq('id', agenteId).maybeSingle(),
    ]);

    if (!alvo || alvo.ativo === false) {
      return { success: false, error: 'Agente não encontrado ou inativo.' };
    }
    if (!aprovador || !(PODE_REDEFINIR[aprovador.role] ?? []).includes(alvo.role)) {
      return { success: false, error: 'Você não pode redefinir a senha desta conta.' };
    }

    const { error } = await admin.auth.admin.updateUserById(agenteId, { password: parsed.data });
    if (error) throw error;

    // Ato administrativo: dá acesso à conta de outra pessoa. A trilha guarda
    // quem fez, e nunca a senha.
    await registrarAcao('REDEFINIR_SENHA', 'agentes', agenteId, undefined, {
      redefinida_por: aprovadorId,
    });

    return { success: true };
  } catch (err) {
    console.error('Erro ao redefinir senha de acesso:', err);
    return { success: false, error: 'Erro interno ao redefinir a senha.' };
  }
}

// ---------------------------------------------------------------------------
// Rejeitar solicitação
// ---------------------------------------------------------------------------
export async function rejeitarSolicitacao(
  solicitacaoId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Mesma regra da aprovacao. Rejeitar tambem e ato administrativo: deixar
    // aberto permitiria a qualquer pessoa derrubar o cadastro de um colega.
    const autorizacao = await exigirAprovador();
    if (!autorizacao.ok) {
      return { success: false, error: autorizacao.erro };
    }
    const aprovadorId = autorizacao.aprovadorId;

    const { allowed } = await rateLimit(`rejeitar:${aprovadorId}`, 20, 60_000);
    if (!allowed) {
      return { success: false, error: 'Muitas tentativas. Aguarde um minuto.' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('solicitacoes_registro')
      .update({
        status: 'rejeitado',
        motivo_rejeicao: motivo,
        aprovado_por: aprovadorId,
        aprovado_em: new Date().toISOString(),
      })
      .eq('id', solicitacaoId)
      .eq('status', 'pendente');

    if (error) {
      throw error;
    }

    // Rejeitar também é ato administrativo: nega acesso a um colega e precisa
    // ser atribuível a alguém.
    await registrarAcao('REJEITAR_CADASTRO', 'solicitacoes_registro', solicitacaoId, undefined, {
      rejeitado_por: aprovadorId,
    });

    return { success: true };
  } catch (err) {
    console.error('Erro ao rejeitar solicitação:', err);
    return { success: false, error: 'Erro interno ao rejeitar solicitação.' };
  }
}
