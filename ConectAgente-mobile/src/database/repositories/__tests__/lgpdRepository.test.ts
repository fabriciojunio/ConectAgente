/**
 * Testes de consentimento, anonimização e retenção.
 *
 * O que estes testes protegem.
 *
 * `utils/lgpd.ts` tem `criarConsentimento`, `anonimizarMorador` e
 * `calcularDataExpiracao` desde o começo do projeto, e a tabela
 * `consentimentos` está no schema desde o começo também. Nenhuma tela chamava
 * nenhum dos três, e nenhuma linha era gravada. O sistema dizia, na tela do
 * agente, estar em conformidade com a LGPD, e não tinha prova de consentimento
 * nem caminho para o direito à eliminação.
 *
 * Os três casos que mais importam aqui:
 *
 * **Anonimizar não é apagar.** O atendimento aconteceu e a unidade precisa do
 * número. O que sai é o vínculo com a pessoa.
 *
 * **Revogar não apaga o aceite anterior.** Apagar tiraria justamente a prova
 * de que ele existiu. A lei pede o histórico, não o estado final.
 *
 * **Prazo vencido não apaga nada sozinho.** Um sistema que elimina prontuário
 * por conta própria é pior que um que guarda demais.
 */
import { lgpdRepository, RETENCAO_ANOS } from '../lgpdRepository';
import { getDatabase } from '../../database';
import { auditRepository } from '../auditRepository';

jest.mock('../../database');
jest.mock('../auditRepository', () => ({
  ACOES_AUDITORIA: { DELETE: 'DELETE' },
  auditRepository: { registrar: jest.fn().mockResolvedValue(true) },
}));

const runAsync = jest.fn();
const getFirstAsync = jest.fn();
const getAllAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getDatabase as jest.Mock).mockResolvedValue({ runAsync, getFirstAsync, getAllAsync });
  runAsync.mockResolvedValue(undefined);
  getAllAsync.mockResolvedValue([]);
});

describe('consentimento', () => {
  it('grava o que prova o aceite', async () => {
    const c = await lgpdRepository.registrarConsentimento({
      moradorId: 'm1',
      dadosColetados: ['nome', 'cpf', 'data_nascimento'],
    });

    expect(c).not.toBeNull();
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO consentimentos');
    expect(params[1]).toBe('m1');
    expect(params[3]).toBe(1); // aceito
    // Versão da política e data são o que permite provar o aceite depois.
    expect(params[4]).toBeTruthy();
    expect(params[5]).toBeTruthy();
    expect(params[6]).toBe('nome,cpf,data_nascimento');
  });

  it('não derruba o cadastro quando a gravação falha', async () => {
    // O morador já foi criado quando isto roda. Lançar aqui faria a tela
    // dizer que o cadastro não deu certo depois de ele ter acontecido.
    runAsync.mockRejectedValue(new Error('disco cheio'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      lgpdRepository.registrarConsentimento({ moradorId: 'm1', dadosColetados: ['nome'] })
    ).resolves.toBeNull();
  });

  it('revogar grava um registro novo, e não apaga o anterior', async () => {
    await lgpdRepository.revogarConsentimento('m1');

    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toContain('INSERT INTO consentimentos');
    expect(sql).not.toContain('DELETE');
    expect(sql).not.toContain('UPDATE');
    expect(params[3]).toBe(0); // aceito = falso
  });

  it('lê o histórico do mais recente para o mais antigo', async () => {
    getAllAsync.mockResolvedValue([{ id: 'c1', morador_id: 'm1', aceito: 0 }]);
    const lista = await lgpdRepository.consentimentosDe('m1');

    expect(getAllAsync.mock.calls[0][0]).toContain('ORDER BY data_aceite DESC');
    expect(lista[0].aceito).toBe(false);
  });
});

describe('anonimização', () => {
  const MORADOR = {
    id: 'm1',
    nome: 'Jose Pereira Lima',
    cpf: '52998224725',
    cartao_sus: '123456789012345',
    telefone: '14999999999',
    data_nascimento: '1985-03-15',
    nome_mae: 'Maria Lima',
  };

  it('apaga a identificação e mantém o registro', async () => {
    getFirstAsync.mockResolvedValue(MORADOR);
    const feito = await lgpdRepository.anonimizar('m1', 'agente-1');

    expect(feito).toBe(true);
    const [sql, params] = runAsync.mock.calls[0];

    // Não é DELETE: o atendimento aconteceu e a unidade precisa do número.
    expect(sql).toContain('UPDATE moradores');
    expect(sql).not.toMatch(/DELETE\s+FROM/i);

    const gravado = JSON.stringify(params);
    for (const pessoal of ['Jose Pereira Lima', '52998224725', '123456789012345',
      '14999999999', '1985-03-15', 'Maria Lima']) {
      expect(gravado).not.toContain(pessoal);
    }
    expect(params[0]).toBe('ANONIMIZADO');
  });

  it('marca a saída com deleted_at', async () => {
    getFirstAsync.mockResolvedValue(MORADOR);
    await lgpdRepository.anonimizar('m1', 'agente-1');

    const sql = runAsync.mock.calls[0][0];
    expect(sql).toContain('deleted_at = ?');
  });

  it('fica na trilha de auditoria, atribuída a quem mandou', async () => {
    getFirstAsync.mockResolvedValue(MORADOR);
    await lgpdRepository.anonimizar('m1', 'agente-1');

    expect(auditRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        agenteId: 'agente-1',
        tabela: 'moradores',
        registroId: 'm1',
      })
    );
  });

  it('devolve false quando o morador não existe, sem gravar nada', async () => {
    getFirstAsync.mockResolvedValue(null);
    expect(await lgpdRepository.anonimizar('nao-existe', 'agente-1')).toBe(false);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('retenção', () => {
  it('o prazo de saúde é maior que o geral', () => {
    // 20 anos vem da Resolução CFM 1.821/2007; 5 do prazo geral do Código
    // Civil. Se alguém inverter, o prontuário passa a ser apagado antes.
    expect(RETENCAO_ANOS.saude).toBe(20);
    expect(RETENCAO_ANOS.geral).toBe(5);
    expect(RETENCAO_ANOS.saude).toBeGreaterThan(RETENCAO_ANOS.geral);
  });

  it('o vencimento calculado cai no futuro', () => {
    const vence = new Date(lgpdRepository.vencimentoDe('saude'));
    expect(vence.getFullYear()).toBe(new Date().getFullYear() + 20);
  });

  it('levanta o que passou do prazo, por tabela', async () => {
    getFirstAsync.mockResolvedValue({ quantidade: 3, mais_antigo: '2001-01-01' });
    const itens = await lgpdRepository.levantarVencidos();

    expect(itens.map((i) => i.tabela)).toEqual(['visitas', 'moradores', 'agendamentos']);
    expect(itens[0].quantidade).toBe(3);
    expect(itens[0].anos).toBe(RETENCAO_ANOS.saude);
  });

  it('conta, e não apaga', async () => {
    // O ponto inteiro. Se isto virar DELETE, prontuário some sozinho.
    getFirstAsync.mockResolvedValue({ quantidade: 5, mais_antigo: '1999-01-01' });
    await lgpdRepository.levantarVencidos();

    expect(runAsync).not.toHaveBeenCalled();
    for (const [sql] of getFirstAsync.mock.calls) {
      expect(sql).toContain('COUNT(*)');
      expect(sql).not.toMatch(/DELETE|DROP|TRUNCATE/i);
    }
  });

  it('a data limite é civil, e não derivada de UTC', async () => {
    // Mesmo defeito que já apareceu três vezes neste projeto: `toISOString()`
    // devolve a data em UTC, e a coluna guarda só a data.
    getFirstAsync.mockResolvedValue({ quantidade: 0, mais_antigo: null });
    await lgpdRepository.levantarVencidos();

    for (const [, params] of getFirstAsync.mock.calls) {
      expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('uma tabela quebrada não derruba o levantamento inteiro', async () => {
    getFirstAsync.mockRejectedValueOnce(new Error('tabela sumiu'));
    getFirstAsync.mockResolvedValue({ quantidade: 1, mais_antigo: '2000-01-01' });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const itens = await lgpdRepository.levantarVencidos();
    expect(itens).toHaveLength(3);
    expect(itens[0].quantidade).toBe(0);
  });
});

/**
 * Guarda das ligações.
 *
 * É o erro que este projeto já cometeu três vezes: `utils/lgpd.ts`,
 * `auditService.ts` no painel e `criarAuditLog` no aplicativo existiam,
 * estavam bem escritos, e nenhuma tela chamava. O código passava em todo
 * teste de unidade e não fazia nada.
 */
describe('as telas realmente chamam', () => {
  const { readFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const RAIZ = join(__dirname, '..', '..', '..');

  function codigo(...partes: string[]): string {
    return (readFileSync(join(RAIZ, ...partes), 'utf-8') as string)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  it('cadastrar morador registra o consentimento', () => {
    const tela = codigo('app', '(app)', 'morador', 'novo.tsx');
    expect(tela).toContain('lgpdRepository.registrarConsentimento');
  });

  it('o consentimento não trava o cadastro', () => {
    // O morador já foi criado quando isto roda.
    const tela = codigo('app', '(app)', 'morador', 'novo.tsx');
    expect(tela).not.toMatch(/await\s+lgpdRepository\.registrarConsentimento/);
    expect(tela).toMatch(/void\s+lgpdRepository\.registrarConsentimento/);
  });

  it('a ficha do morador oferece a eliminação, com confirmação dupla', () => {
    const tela = codigo('app', '(app)', 'morador', '[id].tsx');
    expect(tela).toContain('lgpdRepository.anonimizar');
    // Duas chamadas de Alert encadeadas: pedir e confirmar. Uma só, para algo
    // que não dá para desfazer, é pouco.
    expect((tela.match(/Alert\.alert\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('o painel do gerente mostra o prazo de guarda', () => {
    const tela = codigo('app', '(admin)', 'configuracoes.tsx');
    expect(tela).toContain('lgpdRepository.levantarVencidos');
  });
});
