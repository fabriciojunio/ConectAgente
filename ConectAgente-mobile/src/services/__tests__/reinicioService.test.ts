/**
 * Testes do reinício do aparelho.
 *
 * O que estes testes travam: o reinício apaga tudo junto, e não só a conta do
 * administrador. Voltar só o administrador para "sem senha" deixaria qualquer
 * pessoa com o aparelho na mão entrar como administradora e ver os dados
 * guardados nele.
 */
const mockDb = {
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};
const mockApagarBancoLocal = jest.fn();

jest.mock('../../database/database', () => ({
  getDatabase: jest.fn(async () => mockDb),
  apagarBancoLocal: (...a: unknown[]) => mockApagarBancoLocal(...a),
}));

jest.mock('../../database/repositories/agenteRepository', () => ({
  agenteRepository: { garantirAdminPadrao: jest.fn() },
}));

jest.mock('../../database/limiteDeTentativas', () => ({
  apagarTentativas: jest.fn(),
}));

jest.mock('../authService', () => ({
  authService: { logout: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from 'expo-secure-store';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { apagarTentativas } from '../../database/limiteDeTentativas';
import { authService } from '../authService';
import { reinicioService } from '../reinicioService';

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.getAllAsync.mockResolvedValue([{ id: 'admin-id' }, { id: 'ag-1' }]);
  mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
});

describe('reinicioService.contarNaoSincronizados', () => {
  it('conta pendentes e os que esgotaram as tentativas, que também se perdem', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 3 });

    expect(await reinicioService.contarNaoSincronizados()).toBe(3);
    expect(mockDb.getFirstAsync.mock.calls[0][0]).toContain("status <> 'sincronizado'");
  });
});

describe('reinicioService.reiniciar', () => {
  it('encerra a sessão, apaga o banco e as tentativas, e recria o administrador sem senha', async () => {
    await reinicioService.reiniciar();

    expect(authService.logout).toHaveBeenCalled();
    expect(mockApagarBancoLocal).toHaveBeenCalledWith(mockDb);
    expect(apagarTentativas).toHaveBeenCalled();
    expect(agenteRepository.garantirAdminPadrao).toHaveBeenCalled();
  });

  it('apaga os códigos de recuperação e as pendências de todas as contas', async () => {
    await reinicioService.reiniciar();

    for (const id of ['admin-id', 'ag-1']) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(`conectagente_recuperacao_${id}`);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(`conectagente_senha_servidor_pendente_${id}`);
    }
  });

  it('lê as contas antes de apagar o banco, senão não saberia quais chaves apagar', async () => {
    await reinicioService.reiniciar();

    expect(mockDb.getAllAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockApagarBancoLocal.mock.invocationCallOrder[0]
    );
  });

  it('o administrador volta só depois de o banco estar vazio', async () => {
    await reinicioService.reiniciar();

    expect(mockApagarBancoLocal.mock.invocationCallOrder[0]).toBeLessThan(
      (agenteRepository.garantirAdminPadrao as jest.Mock).mock.invocationCallOrder[0]
    );
  });
});
