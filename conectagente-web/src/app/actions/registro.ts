'use server';

import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema de validação para o formulário de registro
// ---------------------------------------------------------------------------
const registroSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos'),
  telefone: z.string().optional(),
  cargo_pretendido: z.enum(['supervisor', 'outro'], {
    errorMap: () => ({ message: 'Selecione um cargo válido' }),
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
  cargo_pretendido: 'supervisor' | 'outro';
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
      return { success: false, error: parsed.error.errors[0].message };
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
// Aprovar solicitação (requer admin/gerente autenticado)
// ---------------------------------------------------------------------------
export async function aprovarSolicitacao(
  solicitacaoId: string,
  aprovadorId: string,
  senha: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Rate limit: 10 approvals per minute per approver
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
        // Map requested cargo to valid DB roles: supervisor or agente
        role: solicitacao.cargo_pretendido === 'agente' || solicitacao.cargo_pretendido === 'outro'
          ? 'agente'
          : 'supervisor',
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

    return { success: true };
  } catch (err) {
    console.error('Erro ao aprovar solicitação:', err);
    return { success: false, error: 'Erro interno ao aprovar solicitação.' };
  }
}

// ---------------------------------------------------------------------------
// Rejeitar solicitação
// ---------------------------------------------------------------------------
export async function rejeitarSolicitacao(
  solicitacaoId: string,
  aprovadorId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
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

    return { success: true };
  } catch (err) {
    console.error('Erro ao rejeitar solicitação:', err);
    return { success: false, error: 'Erro interno ao rejeitar solicitação.' };
  }
}
