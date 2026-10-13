/**
 * Testes das mensagens de validação em português.
 *
 * O defeito apareceu em uso real, no formulário de primeiro acesso do APK:
 * embaixo do campo de senha vazio aparecia **"Required"**, em inglês, numa
 * tela inteira em português, para um agente comunitário de saúde.
 *
 * A causa era `confirmar_senha: z.string()`, sem mensagem. Quem escreveu o
 * schema cobriu o caso de as senhas não coincidirem e esqueceu o de o campo
 * vir vazio, que é o caso mais comum. Vai acontecer de novo no próximo campo,
 * e por isso a correção é um mapa global e não duas mensagens a mais.
 *
 * Estes testes travam as duas pontas: nenhuma mensagem sai em inglês, e as
 * mensagens que cada schema já declara continuam valendo.
 */
import { z } from 'zod';
import { aplicarMensagensEmPortugues } from '../mensagensDeValidacao';

beforeAll(() => {
  aplicarMensagensEmPortugues();
});

/** Erros que o Zod produz, já traduzidos pelo mapa. */
function erros(schema: z.ZodTypeAny, valor: unknown): string[] {
  const r = schema.safeParse(valor);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe('campo não preenchido', () => {
  it('não diz "Required"', () => {
    // Esta é a mensagem exata que apareceu na tela.
    expect(erros(z.object({ senha: z.string() }), {})).toEqual(['Campo obrigatório']);
  });

  it('trata campo limpo igual a campo nunca preenchido', () => {
    // Para quem olha a tela, `undefined` e `null` querem dizer a mesma coisa.
    expect(erros(z.object({ nome: z.string() }), { nome: null })).toEqual(['Campo obrigatório']);
  });

  it('string vazia com min(1) também é obrigatório, e não "mínimo de 1"', () => {
    expect(erros(z.string().min(1), '')).toEqual(['Campo obrigatório']);
  });
});

describe('as outras mensagens do Zod', () => {
  it.each([
    [z.string().min(8), 'abc', 'Mínimo de 8 caracteres'],
    [z.string().max(5), 'abcdefgh', 'Máximo de 5 caracteres'],
    [z.string().email(), 'nao-e-email', 'E-mail inválido'],
    [z.string().url(), 'nao-e-url', 'Endereço inválido'],
    [z.string().uuid(), 'abc', 'Identificador inválido'],
    [z.number().min(10), 5, 'O mínimo é 10'],
    [z.number().max(10), 50, 'O máximo é 10'],
    [z.enum(['a', 'b']), 'c', 'Escolha uma das opções'],
  ])('traduz o caso %#', (schema, valor, esperado) => {
    expect(erros(schema, valor)).toEqual([esperado]);
  });

  it('tipo errado não é tratado como campo vazio', () => {
    expect(erros(z.string(), 42)).toEqual(['Valor inválido']);
  });
});

describe('o que o mapa não atropela', () => {
  it('a mensagem própria do schema continua valendo', () => {
    // O mapa só responde quando não há mensagem. Se ele passasse por cima,
    // todo texto específico do projeto viraria genérico.
    const schema = z.object({
      cpf: z.string().min(11, 'CPF precisa de 11 dígitos'),
    });
    expect(erros(schema, { cpf: '123' })).toEqual(['CPF precisa de 11 dígitos']);
  });

  it('a mensagem de um refine próprio continua valendo', () => {
    const schema = z
      .object({ senha: z.string(), confirmar: z.string() })
      .refine((d) => d.senha === d.confirmar, {
        path: ['confirmar'],
        message: 'As senhas não coincidem',
      });
    expect(erros(schema, { senha: 'a', confirmar: 'b' })).toEqual(['As senhas não coincidem']);
  });
});

describe('nenhuma mensagem sai em inglês', () => {
  const casos: Array<[z.ZodTypeAny, unknown]> = [
    [z.object({ x: z.string() }), {}],
    [z.object({ x: z.number() }), {}],
    [z.object({ x: z.boolean() }), {}],
    [z.string().min(3), 'a'],
    [z.string().max(2), 'abc'],
    [z.string().email(), 'x'],
    [z.number().min(1), 0],
    [z.enum(['a']), 'z'],
    [z.string(), 123],
    [z.array(z.string()).min(2), ['a']],
  ];

  const EM_INGLES = /\b(Required|Invalid|Expected|received|String|Number|must contain|at least|at most)\b/;

  it.each(casos.map((c, i) => [i, c[0], c[1]]))('caso %i', (_i, schema, valor) => {
    for (const msg of erros(schema as z.ZodTypeAny, valor)) {
      expect(msg).not.toMatch(EM_INGLES);
    }
  });
});

describe('o mapa está ligado na raiz do aplicativo', () => {
  it('o _layout chama a aplicação do mapa', () => {
    // Função pronta e nunca chamada é o erro que este projeto já cometeu
    // quatro vezes. O mapa precisa estar no lugar antes do primeiro
    // formulário validar, e por isso roda na importação do módulo.
    const { readFileSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const raiz = readFileSync(join(__dirname, '..', '..', 'app', '_layout.tsx'), 'utf-8') as string;

    expect(raiz).toContain('aplicarMensagensEmPortugues()');
  });
});
