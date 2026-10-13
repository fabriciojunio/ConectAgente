/**
 * Testes da trilha de auditoria da LGPD.
 *
 * O que estes testes protegem, além do óbvio:
 *
 * **Que a trilha exista.** A tabela `audit_log` e a tela do gerente existiam
 * desde o começo, e um único evento era gravado, a troca de senha. Abrir o
 * prontuário de alguém não deixava rastro, o que contraria o art. 37 da Lei
 * 13.709/2018. O painel mostrava "Entradas no audit log: 0" num banco com
 * morador, residência e visita cadastrados.
 *
 * **Que ela não guarde dado sensível.** Uma trilha que copia o prontuário
 * multiplica o problema que deveria vigiar.
 *
 * **Que falhar ao auditar não desfaça a operação.** Já houve um defeito assim
 * aqui: a auditoria quebrava por nome de coluna errado, a exceção subia, e a
 * tela dizia que a troca de senha não deu certo depois de ela ter acontecido.
 * O agente em campo não pode perder a visita registrada porque o log falhou.
 */
import { auditRepository, ACOES_AUDITORIA } from '../auditRepository';
import { getDatabase } from '../../database';

jest.mock('../../database');

const runAsync = jest.fn();
const getFirstAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (getDatabase as jest.Mock).mockResolvedValue({ runAsync, getFirstAsync });
  runAsync.mockResolvedValue(undefined);
});

describe('registrar', () => {
  it('grava nas colunas que a tabela tem', async () => {
    const ok = await auditRepository.registrar({
      agenteId: 'agente-1',
      acao: ACOES_AUDITORIA.LEITURA,
      tabela: 'prontuarios',
      registroId: 'morador-9',
    });

    expect(ok).toBe(true);
    const [sql, params] = runAsync.mock.calls[0];

    // A coluna `detalhes` não existe em schema nenhum, e já derrubou uma
    // troca de senha neste projeto.
    expect(sql).not.toContain('detalhes');
    expect(sql).toContain('INSERT INTO audit_log');
    expect(params[1]).toBe('agente-1');
    expect(params[2]).toBe('LEITURA');
    expect(params[3]).toBe('prontuarios');
    expect(params[4]).toBe('morador-9');
  });

  it('o contexto vira JSON, e fica nulo quando não há', async () => {
    await auditRepository.registrar({
      agenteId: 'a',
      acao: ACOES_AUDITORIA.EXPORT,
      tabela: 'visitas',
      registroId: 'a',
      contexto: { periodo: 'dia', quantidade: 3 },
    });
    expect(JSON.parse(runAsync.mock.calls[0][1][5])).toEqual({
      periodo: 'dia',
      quantidade: 3,
    });

    runAsync.mockClear();
    await auditRepository.registrar({
      agenteId: 'a',
      acao: ACOES_AUDITORIA.LOGIN,
      tabela: 'agentes',
      registroId: 'a',
    });
    expect(runAsync.mock.calls[0][1][5]).toBeNull();
  });

  it('não lança quando o banco falha, e devolve false', async () => {
    // Este é o ponto. Quem chama não espera o resultado e não trata erro: se
    // isto lançar, a visita registrada em campo se perde porque o log falhou.
    runAsync.mockRejectedValue(new Error('disco cheio'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      auditRepository.registrar({
        agenteId: 'a',
        acao: ACOES_AUDITORIA.INSERT,
        tabela: 'moradores',
        registroId: 'm1',
      })
    ).resolves.toBe(false);
  });

  it('não lança quando nem o banco abre', async () => {
    (getDatabase as jest.Mock).mockRejectedValue(new Error('sem banco'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      auditRepository.registrar({
        agenteId: 'a',
        acao: ACOES_AUDITORIA.LOGIN,
        tabela: 'agentes',
        registroId: 'a',
      })
    ).resolves.toBe(false);
  });
});

describe('o que a trilha guarda', () => {
  it('nenhum campo de prontuário entra no registro', async () => {
    // O registro diz qual tabela e qual id, não o que havia dentro.
    await auditRepository.registrar({
      agenteId: 'a',
      acao: ACOES_AUDITORIA.LEITURA,
      tabela: 'prontuarios',
      registroId: 'm1',
      contexto: { origem: 'tela de prontuario' },
    });

    const gravado = JSON.stringify(runAsync.mock.calls[0][1]);
    for (const sensivel of [
      'hipertenso',
      'diabetico',
      'cpf',
      'cartao_sus',
      'pressao',
      'glicemia',
      'medicamento',
    ]) {
      expect(gravado.toLowerCase()).not.toContain(sensivel);
    }
  });
});

describe('contar', () => {
  it('devolve o total', async () => {
    getFirstAsync.mockResolvedValue({ count: 7 });
    expect(await auditRepository.contar()).toBe(7);
  });

  it('devolve zero quando a consulta falha, em vez de quebrar a tela', async () => {
    getFirstAsync.mockRejectedValue(new Error('x'));
    expect(await auditRepository.contar()).toBe(0);
  });
});

describe('o vocabulário de ações', () => {
  it('cobre os eventos que o sistema registra', () => {
    expect(Object.keys(ACOES_AUDITORIA).sort()).toEqual(
      ['DELETE', 'EXPORT', 'INSERT', 'LEITURA', 'LOGIN', 'RESET_SENHA', 'UPDATE'].sort()
    );
  });

  it('o painel do gerente desenha ícone para todas', () => {
    // Ação que o painel não conhece cai no ícone genérico, e aí a tela de
    // auditoria perde justamente a leitura de prontuário no meio da lista.
    const { readFileSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const painel = readFileSync(
      join(__dirname, '..', '..', '..', 'app', '(admin)', 'configuracoes.tsx'),
      'utf-8'
    ) as string;

    const mapa = painel.slice(painel.indexOf('criarAcaoIcons'));
    const ateFechar = mapa.slice(0, mapa.indexOf('});'));

    for (const acao of Object.values(ACOES_AUDITORIA)) {
      expect(ateFechar).toContain(`${acao}:`);
    }
  });
});

/**
 * Guarda dos pontos de chamada.
 *
 * O repositório existir não adianta se ninguém o chamar, e foi exatamente
 * isso que aconteceu com `utils/lgpd.ts`: o arquivo tem `criarAuditLog`,
 * `criarConsentimento` e `anonimizarMorador` desde o começo, e nenhuma tela
 * jamais chamou nenhum dos três.
 */
describe('os eventos que precisam de registro estão ligados', () => {
  const { readFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');

  const RAIZ = join(__dirname, '..', '..', '..');

  function codigo(...partes: string[]): string {
    return (readFileSync(join(RAIZ, ...partes), 'utf-8') as string)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  }

  it('abrir prontuário registra leitura', () => {
    // É o evento de maior peso: leitura de dado de saúde de uma pessoa.
    const tela = codigo('app', '(app)', 'prontuario', '[moradorId].tsx');
    expect(tela).toContain('auditRepository.registrar');
    expect(tela).toContain('ACOES_AUDITORIA.LEITURA');
  });

  it('exportar relatório registra a saída de dado', () => {
    const tela = codigo('app', '(app)', 'relatorios.tsx');
    expect(tela).toContain('auditRepository.registrar');
    expect(tela).toContain('ACOES_AUDITORIA.EXPORT');
  });

  it('entrar no sistema registra o login', () => {
    const servico = codigo('services', 'authService.ts');
    expect(servico).toContain('auditRepository.registrar');
    expect(servico).toContain('ACOES_AUDITORIA.LOGIN');
  });

  it('nenhuma chamada espera o resultado da auditoria', () => {
    // `await` aqui faria a tela depender do log. Falhar ao auditar não pode
    // atrasar nem derrubar a operação de negócio.
    for (const partes of [
      ['app', '(app)', 'prontuario', '[moradorId].tsx'],
      ['app', '(app)', 'relatorios.tsx'],
      ['services', 'authService.ts'],
    ]) {
      const fonte = codigo(...partes);
      expect(fonte).not.toMatch(/await\s+auditRepository\.registrar/);
      expect(fonte).toMatch(/void\s+auditRepository\.registrar/);
    }
  });
});
