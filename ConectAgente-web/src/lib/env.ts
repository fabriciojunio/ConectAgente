import { z } from 'zod';

/**
 * Contrato das variáveis de ambiente.
 *
 * Por que isto existe. O cliente Supabase caía num endereço de exemplo quando
 * a variável faltava:
 *
 *   process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
 *
 * Em desenvolvimento isso é conveniente, e é por isso que o padrão continua
 * existindo. Em produção é perigoso de um jeito específico: o painel sobe, as
 * telas renderizam, toda consulta falha, e a tela mostra lista vazia em vez de
 * erro. Quem usa conclui que não há paciente cadastrado. Para sistema de
 * secretaria de saúde, "parece que funciona" é pior que "não sobe".
 *
 * Os módulos do app não importam este arquivo no escopo de módulo. O build de
 * produção roda sem segredo nenhum (o CI usa valores de exemplo), e validar na
 * importação derrubaria o build. Quem chama é o `/api/health` e os scripts
 * operacionais, onde falhar cedo é o que se quer.
 */
/**
 * O Supabase tem dois formatos de chave em circulação, e os dois são válidos.
 *
 * O antigo é um JWT: `eyJ...` em três partes separadas por ponto, passando de
 * 100 caracteres. O novo começa com `sb_publishable_` e tem 46. Projeto criado
 * depois da mudança sai só com o novo.
 *
 * Exigir 100 caracteres recusava a chave nova, e aqui o estrago seria o do
 * `/api/health` responder degradado com o ambiente perfeitamente configurado.
 *
 * O formato novo traz uma vantagem que o antigo não tinha: `sb_publishable_` e
 * `sb_secret_` se distinguem à vista. No formato antigo, `anon` e
 * `service_role` eram dois JWTs parecidos, e trocar uma pela outra só aparecia
 * em produção, com o RLS ignorado.
 */
const PREFIXO_PUBLICA = 'sb_publishable_';
const PREFIXO_SECRETA = 'sb_secret_';
const TAMANHO_MINIMO_JWT = 100;

function ehJwt(v: string): boolean {
  return v.split('.').length === 3 && v.length >= TAMANHO_MINIMO_JWT;
}

export function ehChavePublicaValida(v: string): boolean {
  if (v.startsWith(PREFIXO_SECRETA)) return false;
  if (v.startsWith(PREFIXO_PUBLICA)) return v.length > PREFIXO_PUBLICA.length;
  return ehJwt(v);
}

export function ehChaveSecretaValida(v: string): boolean {
  if (v.startsWith(PREFIXO_PUBLICA)) return false;
  if (v.startsWith(PREFIXO_SECRETA)) return v.length > PREFIXO_SECRETA.length;
  return ehJwt(v);
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL')
    .refine(
      (v) => !v.includes('placeholder') && !v.includes('seu-projeto'),
      'NEXT_PUBLIC_SUPABASE_URL ainda está com o valor de exemplo'
    ),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .refine(
      (v) => !v.includes('placeholder'),
      'NEXT_PUBLIC_SUPABASE_ANON_KEY ainda está com o valor de exemplo'
    )
    .refine(
      ehChavePublicaValida,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY não parece uma chave publicável: espera-se sb_publishable_... ou um JWT de três partes'
    ),

  /**
   * Só no servidor. Ignora o RLS por definição, então nunca pode aparecer em
   * variável com prefixo NEXT_PUBLIC_, que o Next embute no pacote do
   * navegador.
   */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .refine(
      ehChaveSecretaValida,
      'SUPABASE_SERVICE_ROLE_KEY não parece uma chave secreta: espera-se sb_secret_... ou um JWT de três partes. Chave publicável aqui deixaria o painel sem os poderes que ele precisa, e a secreta no lugar da publicável iria para o navegador'
    )
    .optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export interface ResultadoValidacao {
  valido: boolean;
  problemas: string[];
}

/**
 * Confere o ambiente e devolve os problemas, sem derrubar o processo.
 *
 * Devolve em vez de lançar porque quem chama decide: o `/api/health` responde
 * com estado degradado, um script operacional encerra.
 */
export function conferirEnv(fonte: NodeJS.ProcessEnv = process.env): ResultadoValidacao {
  const parsed = schema.safeParse(fonte);
  if (parsed.success) return { valido: true, problemas: [] };

  const problemas: string[] = [];
  for (const [campo, mensagens] of Object.entries(parsed.error.flatten().fieldErrors)) {
    for (const m of mensagens ?? []) problemas.push(`${campo}: ${m}`);
  }
  return { valido: false, problemas };
}

/**
 * Diz se a chave de serviço vazou para o lado do navegador.
 *
 * Nunca deveria acontecer, e é o tipo de erro que passa num `git diff` com
 * pressa: basta alguém renomear a variável para NEXT_PUBLIC_ para "funcionar
 * no cliente". Se acontecer, a chave que ignora o RLS vai dentro do pacote
 * publicado, e qualquer pessoa lê o prontuário de todos.
 */
export function chaveDeServicoVazou(fonte: NodeJS.ProcessEnv = process.env): boolean {
  return Object.keys(fonte).some(
    (k) => k.startsWith('NEXT_PUBLIC_') && k.toUpperCase().includes('SERVICE_ROLE')
  );
}
