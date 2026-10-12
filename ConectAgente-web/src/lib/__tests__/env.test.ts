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

const CHAVE_LONGA = 'a'.repeat(120);

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
    const r = conferirEnv({ ...VALIDO, SUPABASE_SERVICE_ROLE_KEY: CHAVE_LONGA });
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

  it('recusa chave curta demais para ser real', () => {
    // A chave `anon` do Supabase é um JWT e passa de 100 caracteres. O que
    // estava no .env do projeto tinha 39: era só o cabeçalho do JWT.
    const r = conferirEnv({
      ...VALIDO,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    });
    expect(r.valido).toBe(false);
    expect(r.problemas.join(' ')).toContain('truncada');
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
    const vazou = { ...VALIDO, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: CHAVE_LONGA };
    expect(chaveDeServicoVazou(vazou)).toBe(true);
  });

  it('acusa mesmo com o nome escrito de outro jeito', () => {
    const vazou = { ...VALIDO, NEXT_PUBLIC_service_role_TOKEN: 'x' };
    expect(chaveDeServicoVazou(vazou)).toBe(true);
  });

  it('não confunde a chave de serviço legítima, sem prefixo público', () => {
    const certo = { ...VALIDO, SUPABASE_SERVICE_ROLE_KEY: CHAVE_LONGA };
    expect(chaveDeServicoVazou(certo)).toBe(false);
  });
});
