/**
 * Segundo fator do painel.
 *
 * O painel é onde se lê o dado de todas as famílias de uma unidade, ou da
 * cidade inteira. Com só a senha, quem a descobrisse (vazamento em outro site,
 * phishing, papel colado no monitor) tinha esse acesso. Agora toda conta do
 * painel cadastra um app autenticador (TOTP) e confirma o código de 6 dígitos
 * a cada login.
 *
 * A decisão usa o nível de garantia da sessão, que vem assinado dentro do JWT
 * (`aal`), e não algo que o navegador possa afirmar:
 *
 *   aal2                         -> já confirmou o código nesta sessão
 *   aal1 e há fator cadastrado   -> falta confirmar o código
 *   aal1 e nenhum fator          -> falta cadastrar o autenticador
 */

export const ROTA_DO_SEGUNDO_FATOR = '/segundo-fator';

export type DecisaoDoSegundoFator = 'liberado' | 'verificar' | 'cadastrar';

export interface NivelDaSessao {
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
}

export function decidirSegundoFator(nivel: NivelDaSessao | null | undefined): DecisaoDoSegundoFator {
  if (nivel?.currentLevel === 'aal2') return 'liberado';
  if (nivel?.nextLevel === 'aal2') return 'verificar';
  return 'cadastrar';
}

/** O código do autenticador: exatamente seis dígitos, sem espaço. */
export function codigoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}
