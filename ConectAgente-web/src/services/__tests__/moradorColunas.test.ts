/**
 * Contrato entre o painel e o GRANT de colunas de `moradores`.
 *
 * O banco recusa ler cpf, cartão do SUS, doença e medicação direto: eles só
 * saem por `fn_ler_morador`, que registra a leitura (LGPD, art. 37). Se o
 * painel pedir uma coluna fora do GRANT, a tela inteira volta vazia com erro
 * de permissão. Se o GRANT for ampliado sem querer, a auditoria vira
 * contornável de novo. Estes testes travam as duas pontas.
 */
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@/lib/supabase/client';
import { MORADOR_COLUNAS_LISTA } from '../moradorColunas';
import { buscarMoradoresPorDocumento } from '../moradorService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const SENSIVEIS = [
  'cpf',
  'cartao_sus',
  'telefone',
  'cidade_nascimento',
  'nome_pai',
  'nome_mae',
  'escolaridade',
  'profissao',
  'doencas',
  'beneficio_bolsa_familia',
  'tem_convenio',
  'convenio_nome',
  'toma_medicamento',
  'medicamentos_lista',
];

function colunasDoPainel(): string[] {
  return MORADOR_COLUNAS_LISTA.split(',').map((c) => c.trim()).sort();
}

function colunasDoGrant(): string[] {
  const sql = readFileSync(
    join(__dirname, '..', '..', '..', 'supabase', 'migration_colunas_sensiveis.sql'),
    'utf-8'
  );
  const bloco = sql.match(/GRANT SELECT \(([\s\S]*?)\) ON moradores TO authenticated/);
  if (!bloco) throw new Error('GRANT de moradores não encontrado na migração');
  return bloco[1].split(',').map((c) => c.trim()).filter(Boolean).filter((c) => c !== 'sync_status').sort();
}

describe('colunas de morador', () => {
  it('a lista do painel é a mesma do GRANT do banco', () => {
    // sync_status só interessa ao aplicativo e fica fora da lista do painel.
    expect(colunasDoPainel()).toEqual(colunasDoGrant());
  });

  it('nenhuma coluna sensível está na lista', () => {
    for (const coluna of SENSIVEIS) {
      expect(colunasDoPainel()).not.toContain(coluna);
    }
  });

  it('nenhum serviço pede moradores(*) nem o cpf do morador direto', () => {
    const pasta = join(__dirname, '..');
    const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.ts'));
    for (const arquivo of arquivos) {
      const fonte = readFileSync(join(pasta, arquivo), 'utf-8');
      expect({ arquivo, pedeTudo: fonte.includes('moradores(*)') }).toEqual({ arquivo, pedeTudo: false });
      expect({ arquivo, pedeCpf: /moradores\([^)]*\bcpf\b/.test(fonte) }).toEqual({ arquivo, pedeCpf: false });
    }
  });
});

describe('buscarMoradoresPorDocumento', () => {
  it('chama a função auditada do banco com o documento', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ id: 'm1', nome: 'Dados simulados' }], error: null });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);

    const achados = await buscarMoradoresPorDocumento('11144477735');

    expect(rpc).toHaveBeenCalledWith('fn_buscar_morador_por_documento', { p_documento: '11144477735' });
    expect(achados).toHaveLength(1);
  });

  it('devolve lista vazia quando o banco não acha nada', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);

    expect(await buscarMoradoresPorDocumento('11144477735')).toEqual([]);
  });

  it('falha do banco vira mensagem para a tela, sem o texto técnico', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    mockCreateClient.mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const busca = buscarMoradoresPorDocumento('11144477735');
    await expect(busca).rejects.toThrow('Não foi possível buscar por documento');
    await expect(busca).rejects.not.toThrow('permission denied');
  });
});
