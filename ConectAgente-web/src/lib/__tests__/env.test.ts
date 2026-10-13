/**
 * Testes do contrato de variáveis de ambiente.
 *
 * O que isto protege: o cliente Supabase caía num endereço de exemplo quando a
 * variável faltava. Em produção o painel sobe, as telas renderizam, toda
 * consulta falha, e a tela mostra lista vazia em vez de erro. Quem usa conclui
 * que não há paciente cadastrado. Para sistema de secretaria de saúde,
 * "parece que funciona" é pior que "não sobe".
 */
import { conferirEnv, chaveDeServicoVazou } from '../env';

/**
 * Chaves com formato de verdade.
 *
 * O dado anterior era `'a'.repeat(120)`: passava no `.min(100)` e não era um
 * JWT, porque não tinha os três pedaços separados por ponto. Dado de teste que
 * nenhum servidor aceitaria dá a impressão de cobertura que não existe.
 *
 * O Supabase hoje tem dois formatos em circulação, e os dois valem: o JWT
 * antigo e o `sb_publishable_` / `sb_secret_`, que é o que sai em projeto novo.
 */
const JWT_PUBLICA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(120) + '.assinatura';
const PUBLICAVEL = 'sb_publishable_ExemploDeChaveParaTeste_000000';
const SECRETA = 'sb_secret_ExemploDeChaveParaTeste_000000';
const CHAVE_LONGA = JWT_PUBLICA;

const VALIDO: NodeJS.ProcessEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghij.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: CHAVE_LONGA,
  NODE_ENV: 'production',
};

describe('conferirEnv: ambiente completo', () => {
  it('aceita configuração válida', () => {
    expect(conferirEnv(VALIDO)).toEqual({ valido: true, problemas: [] });
  });

  it('aceita a chave de serviço quando ela existe', () => {
    const r = conferirEnv({ ...VALIDO, SUPABASE_SERVICE_ROLE_KEY: SECRETA });
    expect(r.valido).toBe(true);
  });

  it('a chave de serviço é opcional, porque o painel lê sem ela', () => {
    const r = conferirEnv(VALIDO);
    expect(r.valido).toBe(true);
  });
});

describe('conferirEnv: o que estava passando batido', () => {
  it('recusa a URL de exemplo que o código usava como padrão', () => {
    const r = conferirEnv({
      ...VALIDO,
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
    });
    expect(r.valido).toBe(false);
    expect(r.problemas.join(' ')).toContain('valor de exemplo');
  });

  it('recusa a URL do arquivo de exemplo do repositório', () => {
    const r = conferirEnv({
      ...VALIDO,
      NEXT_PUBLIC_SUPABASE_URL: 'https://seu-projeto.supabase.co',
    });
    expect(r.valido).toBe(false);
  });

  it('recusa a chave de exemplo', () => {
    const r = conferirEnv({
      ...VALIDO,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    });
    expect(r.valido).toBe(false);
  });

  it('recusa o cabeçalho do JWT, que é o que vinha no .env do projeto', () => {
    // Tinha 39 caracteres: era só o cabeçalho, sem corpo nem assinatura. A
    // mensagem diz o que se espera, porque quem configura precisa saber o que
    // procurar no painel, não só que está errado.
    const r = conferirEnv({
      ...VALIDO,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    });
    expect(r.valido).toBe(false);
    expect(r.problemas.join(' ')).toContain('sb_publishable_');
  });

  it('recusa URL ausente', () => {
    const semUrl = { ...VALIDO };
    delete semUrl.NEXT_PUBLIC_SUPABASE_URL;
    expect(conferirEnv(semUrl).valido).toBe(false);
  });

  it('recusa URL que não é URL', () => {
    const r = conferirEnv({ ...VALIDO, NEXT_PUBLIC_SUPABASE_URL: 'nao-e-url' });
    expect(r.valido).toBe(false);
  });

  it('lista todos os problemas de uma vez, e não só o primeiro', () => {
    // Quem está configurando o ambiente quer a lista inteira, não descobrir
    // um erro por vez.
    const r = conferirEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'placeholder',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'curta',
    });
    expect(r.valido).toBe(false);
    expect(r.problemas.length).toBeGreaterThanOrEqual(2);
  });
});

describe('chaveDeServicoVazou', () => {
  it('não acusa nada num ambiente correto', () => {
    expect(chaveDeServicoVazou(VALIDO)).toBe(false);
  });

  it('acusa quando a chave de serviço ganha prefixo público', () => {
    // O Next embute toda variável NEXT_PUBLIC_ no pacote do navegador. A
    // chave de serviço ignora o RLS por definição: publicada, qualquer pessoa
    // lê o prontuário de todos. É o tipo de erro que nasce de alguém tentar
    // "fazer funcionar no cliente".
    const vazou = { ...VALIDO, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: SECRETA };
    expect(chaveDeServicoVazou(vazou)).toBe(true);
  });

  it('acusa mesmo com o nome escrito de outro jeito', () => {
    const vazou = { ...VALIDO, NEXT_PUBLIC_service_role_TOKEN: 'x' };
    expect(chaveDeServicoVazou(vazou)).toBe(true);
  });

  it('não confunde a chave de serviço legítima, sem prefixo público', () => {
    const certo = { ...VALIDO, SUPABASE_SERVICE_ROLE_KEY: SECRETA };
    expect(chaveDeServicoVazou(certo)).toBe(false);
  });
});

describe('os dois formatos de chave do Supabase', () => {
  // Em 13/10/2026 o projeto de verdade saiu com `sb_publishable_`, de 46
  // caracteres, e a regra antiga exigia 100. O painel teria respondido
  // degradado no /api/health com o ambiente perfeitamente configurado.
  it('aceita a chave publicável do formato novo', () => {
    const r = conferirEnv({ ...VALIDO, NEXT_PUBLIC_SUPABASE_ANON_KEY: PUBLICAVEL });
    expect(r.valido).toBe(true);
  });

  it('aceita o JWT antigo', () => {
    const r = conferirEnv({ ...VALIDO, NEXT_PUBLIC_SUPABASE_ANON_KEY: JWT_PUBLICA });
    expect(r.valido).toBe(true);
  });

  it('recusa a chave secreta no lugar da publicável', () => {
    // Iria para o pacote do navegador, e ela ignora o RLS. No formato antigo
    // as duas eram JWTs parecidos e a troca só aparecia em produção.
    const r = conferirEnv({ ...VALIDO, NEXT_PUBLIC_SUPABASE_ANON_KEY: SECRETA });
    expect(r.valido).toBe(false);
  });

  it('recusa a publicável no lugar da secreta', () => {
    const r = conferirEnv({ ...VALIDO, SUPABASE_SERVICE_ROLE_KEY: PUBLICAVEL });
    expect(r.valido).toBe(false);
  });

  it('recusa texto que não tem formato de chave nenhuma', () => {
    const r = conferirEnv({ ...VALIDO, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(120) });
    expect(r.valido).toBe(false);
  });
});
