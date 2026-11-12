/**
 * Traduz a falha da sincronização para o agente.
 *
 * Achado no aparelho: com o servidor recusando a senha, o selo mostrava
 * "19 pendentes", o botão Sincronizar não fazia nada visível e o agente não
 * tinha como saber que a coleta não estava subindo. O erro existia no estado
 * da sincronização, mas nenhuma tela o mostrava.
 */

export const MENSAGEM_CONTA_NAO_LIBERADA =
  'O servidor não reconheceu sua conta, então nada está sendo enviado. Seus dados continuam ' +
  'salvos neste celular. Peça à coordenação para liberar sua conta ou redefinir a sua senha de ' +
  'sincronização no painel, com a mesma senha que você usa aqui. Depois, saia e entre de novo.';

export const MENSAGEM_SEM_REDE =
  'Não foi possível falar com o servidor agora. Seus dados continuam salvos neste celular e ' +
  'serão enviados quando a conexão voltar.';

const SINAIS_DE_CONTA = ['invalid login credentials', 'sem sessão no servidor', 'email not confirmed', 'user not found'];
const SINAIS_DE_REDE = ['network', 'fetch', 'timeout', 'rede', 'failed to'];

export function explicarFalhaDeSincronizacao(mensagem: string | null | undefined): string {
  const m = (mensagem ?? '').toLowerCase();
  if (SINAIS_DE_CONTA.some((s) => m.includes(s))) return MENSAGEM_CONTA_NAO_LIBERADA;
  if (SINAIS_DE_REDE.some((s) => m.includes(s))) return MENSAGEM_SEM_REDE;
  return 'A sincronização falhou. Seus dados continuam salvos neste celular. Tente de novo em alguns minutos; ' +
    'se continuar, avise a coordenação.';
}

/** A falha é da conta (não adianta tentar de novo sem a coordenação agir). */
export function falhaDeConta(mensagem: string | null | undefined): boolean {
  const m = (mensagem ?? '').toLowerCase();
  return SINAIS_DE_CONTA.some((s) => m.includes(s));
}
