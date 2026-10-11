/**
 * Contrato entre o banco local do aparelho e o banco do servidor.
 *
 * Por que isto existe. O aplicativo monta o payload de sincronização com o
 * objeto local. Se o banco local tem uma coluna que o servidor não tem, o
 * PostgREST recusa a linha toda e devolve erro. Como o aplicativo é
 * offline-first, ele continua gravando no SQLite e nada parece errado para o
 * agente em campo, enquanto nada chega ao painel.
 *
 * Não é hipótese. Rodando o schema real num PostgreSQL e repetindo os
 * inserts que o aplicativo faz, o banco respondia:
 *
 *   column "status_sync" of relation "residencias" does not exist
 *   column "motivo_visita" of relation "visitas" does not exist
 *   insert or update on table "prontuario_saude" violates foreign key
 *     constraint "prontuario_saude_prontuario_id_fkey"
 *   new row for relation "agendamentos" violates check constraint
 *     "agendamentos_status_check"
 *   null value in column "meta" of relation "metas_visitas" violates
 *     not-null constraint
 *
 * Eram 61 colunas sem destino no servidor, entre elas o conteúdo clínico
 * inteiro das cinco fichas de prontuário.
 *
 * Nenhum teste de unidade pegava isso, porque cada lado estava certo
 * sozinho: o defeito morava na junta. Este teste lê os dois schemas do disco
 * e compara, consultando as mesmas tabelas de tradução que o
 * `syncQueueRepository` usa em produção. Coluna nova de um lado só, ou nome
 * que divergiu, aparece aqui como falha.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  CAMPOS_SO_LOCAIS,
  RENOMEAR_PARA_SERVIDOR,
} from '../repositories/syncQueueRepository';

const RAIZ_MOBILE = join(__dirname, '..', '..', '..');
const RAIZ_REPO = join(RAIZ_MOBILE, '..');
const DIR_MIGRACOES = join(RAIZ_REPO, 'ConectAgente-web', 'supabase');

const schemaLocal = readFileSync(
  join(RAIZ_MOBILE, 'src', 'database', 'schema.ts'),
  'utf8'
);

/**
 * O schema do servidor é o CREATE TABLE original mais todas as migrações.
 *
 * Lidas por varredura do diretório, e não por lista fixa, para que uma
 * migração nova entre na conferência sem ninguém precisar lembrar de
 * cadastrá-la aqui.
 */
const schemaServidor = [
  readFileSync(join(RAIZ_MOBILE, 'supabase', 'schema.sql'), 'utf8'),
  ...readdirSync(DIR_MIGRACOES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(DIR_MIGRACOES, f), 'utf8')),
].join('\n');

/** Tabelas que o aplicativo empurra para o servidor pela fila de sync. */
const TABELAS_SINCRONIZADAS = [
  'residencias',
  'moradores',
  'visitas',
  'agendamentos',
  'prontuarios',
  'prontuario_saude',
  'prontuario_gestante',
  'prontuario_puericultura',
  'prontuario_mulher',
  'prontuario_social',
  'metas_visitas',
] as const;

/** Palavras que abrem cláusula de tabela e não nome de coluna. */
const CLAUSULAS = ['constraint', 'primary', 'foreign', 'unique', 'check'];

/**
 * Extrai os nomes de coluna de um corpo de CREATE TABLE.
 *
 * Leitura linha a linha de propósito, sem expressão regular com escape, que
 * é fácil de escrever errado e difícil de notar que está errado.
 */
function colunasDoCorpo(corpo: string[]): string[] {
  const nomes: string[] = [];
  for (const bruta of corpo) {
    const linha = bruta.trim();
    if (linha === '' || linha.startsWith('--')) continue;

    const espaco = linha.indexOf(' ');
    if (espaco <= 0) continue;

    const nome = linha.slice(0, espaco).toLowerCase();
    if (CLAUSULAS.includes(nome)) continue;
    if (!/^[a-z_][a-z_0-9]*$/.test(nome)) continue;

    nomes.push(nome);
  }
  return nomes;
}

/** Devolve as linhas do corpo do CREATE TABLE da tabela pedida. */
function corpoDaTabela(schema: string, tabela: string): string[] {
  const abertura = `CREATE TABLE IF NOT EXISTS ${tabela} (`;
  const inicio = schema.indexOf(abertura);
  if (inicio < 0) {
    throw new Error(`tabela ${tabela} nao encontrada no schema`);
  }

  const linhas = schema.slice(inicio + abertura.length).split('\n');
  const corpo: string[] = [];
  for (const linha of linhas) {
    if (linha.trim() === ');') return corpo;
    corpo.push(linha);
  }
  throw new Error(`CREATE TABLE de ${tabela} nao fecha`);
}

function colunasLocais(tabela: string): string[] {
  return colunasDoCorpo(corpoDaTabela(schemaLocal, tabela));
}

function colunasServidor(tabela: string): string[] {
  const doCreate = colunasDoCorpo(corpoDaTabela(schemaServidor, tabela));

  // Soma o que as migrações acrescentaram depois do CREATE TABLE.
  const prefixo = `ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS `;
  const adicionadas = schemaServidor
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith(prefixo))
    .map((l) => l.slice(prefixo.length).trim().split(/\s+/)[0].toLowerCase());

  return [...new Set([...doCreate, ...adicionadas])];
}

/** Nome com que o campo local chega ao servidor, já traduzido. */
function nomeNoServidor(campo: string): string {
  return RENOMEAR_PARA_SERVIDOR[campo] ?? campo;
}

describe('contrato de sincronizacao entre aparelho e servidor', () => {
  it.each(TABELAS_SINCRONIZADAS)(
    'toda coluna que o aplicativo grava em %s tem destino no servidor',
    (tabela) => {
      const servidor = colunasServidor(tabela);
      const semDestino = colunasLocais(tabela)
        .filter((c) => !(CAMPOS_SO_LOCAIS as readonly string[]).includes(c))
        .filter((c) => !servidor.includes(nomeNoServidor(c)));

      expect({ tabela, semDestino }).toEqual({ tabela, semDestino: [] });
    }
  );

  it.each(TABELAS_SINCRONIZADAS)(
    'o aparelho grava toda coluna obrigatoria sem default de %s',
    (tabela) => {
      // Inverso do teste acima: coluna NOT NULL sem DEFAULT no servidor que o
      // aplicativo não preenche faz o insert falhar do outro lado. Foi assim
      // que `metas_visitas.meta` apareceu.
      const traduzidas = new Set(colunasLocais(tabela).map(nomeNoServidor));

      const faltando = corpoDaTabela(schemaServidor, tabela)
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.toUpperCase().includes('NOT NULL') &&
            !l.toUpperCase().includes('DEFAULT') &&
            !l.toUpperCase().includes('PRIMARY KEY')
        )
        .map((l) => l.split(' ')[0].toLowerCase())
        .filter((n) => /^[a-z_][a-z_0-9]*$/.test(n))
        .filter((n) => !traduzidas.has(n));

      expect({ tabela, faltando }).toEqual({ tabela, faltando: [] });
    }
  );

  it('os campos declarados como locais de fato nao existem no servidor', () => {
    // Se um deles passar a existir no servidor, a lista está desatualizada e
    // o aplicativo está descartando um dado que poderia enviar.
    for (const campo of CAMPOS_SO_LOCAIS) {
      for (const tabela of TABELAS_SINCRONIZADAS) {
        expect(colunasServidor(tabela)).not.toContain(campo);
      }
    }
  });

  it('cada renomeacao aponta para uma coluna que existe no servidor', () => {
    // Uma tradução para nome errado seria igual a não traduzir: a linha é
    // recusada em produção e o teste anterior não veria, porque ele só
    // confere que o campo local tem algum destino.
    const todasDoServidor = new Set(
      TABELAS_SINCRONIZADAS.flatMap((t) => colunasServidor(t))
    );
    for (const [local, servidor] of Object.entries(RENOMEAR_PARA_SERVIDOR)) {
      expect({ local, servidor, existe: todasDoServidor.has(servidor) }).toEqual({
        local,
        servidor,
        existe: true,
      });
    }
  });

  it('o servidor tem as oito colunas clinicas da visita', () => {
    const clinicas = [
      'motivo_visita',
      'pa_visita',
      'glicemia_visita',
      'peso_visita',
      'medicamentos_em_dia',
      'cartao_vacinas_em_dia',
      'encaminhamentos',
      'assinatura_base64',
    ];
    const servidor = colunasServidor('visitas');
    for (const c of clinicas) expect(servidor).toContain(c);
  });

  it('o servidor tem o conteudo clinico das cinco fichas de prontuario', () => {
    const porFicha: Record<string, string[]> = {
      prontuario_saude: ['is_tuberculose', 'pa_valor', 'hgt_valor', 'queixas'],
      prontuario_gestante: ['is_gestante', 'semanas_gestacao', 'pre_natal_em_dia'],
      prontuario_puericultura: ['is_crianca', 'cartao_vacina_em_dia', 'frequenta_escola'],
      prontuario_mulher: ['papanicolau_em_dia', 'mamografia_em_dia', 'prevencao_dts'],
      prontuario_social: ['vulnerabilidade_social', 'violencia_domestica', 'negligencia_parental'],
    };

    for (const [ficha, colunas] of Object.entries(porFicha)) {
      const servidor = colunasServidor(ficha);
      for (const c of colunas) {
        expect({ ficha, coluna: c, existe: servidor.includes(c) }).toEqual({
          ficha,
          coluna: c,
          existe: true,
        });
      }
    }
  });
});
