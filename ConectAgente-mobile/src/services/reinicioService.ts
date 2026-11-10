/**
 * Reinício do aparelho: a saída de quem perdeu a senha e o código de
 * recuperação do administrador.
 *
 * O administrador é a conta mais alta do aparelho e não tem acima dele quem
 * gere um código novo. Antes, perder senha e código significava desinstalar
 * o aplicativo, sem aviso nenhum do que se perdia.
 *
 * Por que reiniciar tudo, e não só a conta do administrador. Voltar só o
 * administrador para "sem senha" seria uma porta: qualquer pessoa com o
 * aparelho na mão faria isso e entraria como administradora, com acesso a
 * residências, moradores e visitas guardados nele. Apagando tudo junto, quem
 * reinicia recebe um aparelho vazio, e o que já foi sincronizado continua no
 * servidor, protegido pelo RLS. É o mesmo efeito de desinstalar, só que dentro
 * do aplicativo, dizendo antes quanto ainda não subiu.
 */
import * as SecureStore from 'expo-secure-store';
import { getDatabase, apagarBancoLocal } from '../database/database';
import { agenteRepository } from '../database/repositories/agenteRepository';
import { apagarTentativas } from '../database/limiteDeTentativas';
import { authService } from './authService';
import { SECURE_KEYS } from '../utils/constants';

export const reinicioService = {
  /**
   * Registros que ainda não chegaram ao servidor: pendentes e os que
   * esgotaram as tentativas. Os dois se perdem num reinício.
   */
  async contarNaoSincronizados(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status <> 'sincronizado'`
    );
    return row?.count ?? 0;
  },

  /**
   * Apaga contas, dados, sessão e códigos de recuperação do aparelho, e deixa
   * o administrador esperando a configuração do primeiro uso.
   */
  async reiniciar(): Promise<void> {
    // Os ids saem antes de o banco ser apagado: são eles que dão o nome das
    // chaves dos códigos de recuperação no cofre.
    const db = await getDatabase();
    const contas = await db.getAllAsync<{ id: string }>(`SELECT id FROM agentes`);

    await authService.logout();
    await apagarBancoLocal(db);
    await apagarTentativas();
    for (const { id } of contas) {
      for (const prefixo of [SECURE_KEYS.CODIGO_RECUPERACAO, SECURE_KEYS.SENHA_SERVIDOR_PENDENTE]) {
        await SecureStore.deleteItemAsync(`${prefixo}${id}`).catch(() => undefined);
      }
    }
    await agenteRepository.garantirAdminPadrao();
  },
};
