/**
 * Contrato entre os papéis do código e os CHECK do banco.
 *
 * Por que isto existe. Havia cinco vocabulários diferentes para a mesma
 * coisa, e nenhum teste de unidade podia perceber, porque cada arquivo era
 * coerente consigo mesmo:
 *
 *   banco, agentes.role                  agente, coordenador, gerente, admin
 *   banco, cargo_pretendido              coordenador, gerente, outro
 *   tipo UserRole                        agente, supervisor, admin
 *   formulário de cadastro               supervisor, outro
 *   aprovação no painel                  grava 'supervisor'
 *
 * O efeito, medido num PostgreSQL com o schema real:
 *
 *   cadastro público escolhendo "supervisor":
 *     new row for relation "solicitacoes_registro" violates check constraint
 *     "solicitacoes_registro_cargo_pretendido_check"
 *
 *   aprovação no painel:
 *     new row for relation "agentes" violates check constraint
 *     "agentes_role_check"
 *
 * Nenhum agente conseguia ser provisionado pelo caminho previsto. E o
 * middleware liberava as rotas administrativas só para 'admin' e
 * 'supervisor', então gerente era redirecionado para fora.
 *
 * Este teste lê os CHECK direto dos arquivos de migração e compara com o que
 * o código usa. Papel novo de um lado só aparece aqui.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { SIDEBAR_ITEMS, ROLES } from '../constants';
import { userRoleSchema } from '../validation';
import { papeisDaRota, papelPodeAbrir } from '../rotasPorPapel';

const DIR_SQL = join(__dirname, '..', '..', '..', 'supabase');

const migrationWeb = readFileSync(join(DIR_SQL, 'migration_web.sql'), 'utf8');
const migrationRegistro = readFileSync(join(DIR_SQL, 'migration_registro.sql'), 'utf8');
const middleware = readFileSync(join(__dirname, '..', '..', 'middleware.ts'), 'utf8');
const rls = readFileSync(join(DIR_SQL, 'migration_rls_completo.sql'), 'utf8');

/**
 * Extrai os valores de um `CHECK (coluna IN ('a','b'))`.
 *
 * Leitura por índice em vez de expressão regular com escape, que é fácil de
 * escrever errado e difícil de notar que está errado.
 */
function valoresDoCheck(sql: string, coluna: string): string[] {
  const marcador = `CHECK (${coluna} IN (`;
  const inicio = sql.indexOf(marcador);
  if (inicio < 0) throw new Error(`CHECK de ${coluna} nao encontrado`);

  const depois = inicio + marcador.length;
  const fim = sql.indexOf('))', depois);
  const dentro = sql.slice(depois, fim);

  return dentro
    .split(',')
    .map((p) => p.trim().replace(/^'|'$/g, ''))
    .filter((p) => p !== '');
}

const PAPEIS_DO_BANCO = valoresDoCheck(migrationWeb, 'role');
const CARGOS_DO_BANCO = valoresDoCheck(migrationRegistro, 'cargo_pretendido');

describe('contrato de papeis entre o codigo e o banco', () => {
  it('o CHECK do banco e lido corretamente, senao o teste nao prova nada', () => {
    expect(PAPEIS_DO_BANCO).toEqual(['agente', 'coordenador', 'gerente', 'admin']);
    expect(CARGOS_DO_BANCO).toEqual(['coordenador', 'gerente', 'outro']);
  });

  it('o schema de validacao aceita exatamente os papeis do banco', () => {
    expect([...userRoleSchema.options].sort()).toEqual([...PAPEIS_DO_BANCO].sort());
  });

  it('ROLES descreve exatamente os papeis do banco', () => {
    expect(Object.keys(ROLES).sort()).toEqual([...PAPEIS_DO_BANCO].sort());
  });

  it('nenhum item do menu exige papel que nao existe no banco', () => {
    const invalidos = SIDEBAR_ITEMS.flatMap((item) =>
      (item.roles ?? [])
        .filter((papel) => !PAPEIS_DO_BANCO.includes(papel))
        .map((papel) => `${item.label}: ${papel}`)
    );
    expect(invalidos).toEqual([]);
  });

  it('todo papel do banco ve pelo menos um item do menu', () => {
    // Antes, nenhum papel real via item nenhum: o menu inteiro pedia
    // 'supervisor'. A pessoa entrava no painel e encontrava a barra vazia.
    const semNada = PAPEIS_DO_BANCO.filter(
      (papel) =>
        !SIDEBAR_ITEMS.some((item) => !item.roles || item.roles.includes(papel as never))
    );
    expect(semNada).toEqual([]);
  });

  it('o portão do servidor só fala de papel que existe no banco', () => {
    for (const item of SIDEBAR_ITEMS) {
      for (const papel of papeisDaRota(item.href)) {
        expect({ rota: item.href, papel, existeNoBanco: PAPEIS_DO_BANCO.includes(papel) }).toEqual({
          rota: item.href,
          papel,
          existeNoBanco: true,
        });
      }
    }
    expect(middleware).toContain('papelPodeAbrir(pathname');
  });

  it('a área administrativa usa a mesma regra da policy de auditoria do banco', () => {
    const inicioPolicy = rls.indexOf('audit_log_select');
    expect(inicioPolicy).toBeGreaterThan(-1);
    const trecho = rls.slice(inicioPolicy, inicioPolicy + 400);
    expect(trecho).toContain("'gerente'");
    expect(trecho).toContain("'admin'");

    expect(papelPodeAbrir('/admin', 'gerente')).toBe(true);
    expect(papelPodeAbrir('/admin', 'admin')).toBe(true);
    expect(papelPodeAbrir('/admin', 'coordenador')).toBe(false);
  });
});
