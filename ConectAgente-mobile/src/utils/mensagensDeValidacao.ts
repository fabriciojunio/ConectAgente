import { z } from 'zod';

/**
 * Mensagens de validação em português, para todo o aplicativo.
 *
 * Por que isto existe. O Zod traz mensagens em inglês por padrão, e elas
 * aparecem sempre que um campo não tem mensagem própria. Em uso real, o
 * formulário de primeiro acesso mostrou **"Required"** embaixo do campo de
 * senha, numa tela inteira em português, para um agente comunitário de saúde.
 *
 * O campo em questão era `confirmar_senha: z.string()`, sem mensagem: quem
 * escreveu cobriu o caso de as senhas não coincidirem e não o de o campo vir
 * vazio. É um esquecimento fácil, e vai acontecer de novo no próximo campo.
 *
 * Por isso a correção é um mapa global em vez de duas mensagens a mais: campo
 * novo sem mensagem passa a cair em português, não em inglês.
 *
 * As mensagens específicas que cada schema já declara continuam valendo: o
 * mapa só responde quando não há uma.
 */
const mapa: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      // `undefined` é campo não preenchido; `null` é campo limpo. Para quem
      // está olhando a tela, os dois querem dizer a mesma coisa.
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Campo obrigatório' };
      }
      return { message: 'Valor inválido' };

    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return issue.minimum === 1
          ? { message: 'Campo obrigatório' }
          : { message: `Mínimo de ${issue.minimum} caracteres` };
      }
      if (issue.type === 'number') return { message: `O mínimo é ${issue.minimum}` };
      if (issue.type === 'array') return { message: `Selecione ao menos ${issue.minimum}` };
      return { message: 'Valor abaixo do mínimo' };

    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Máximo de ${issue.maximum} caracteres` };
      if (issue.type === 'number') return { message: `O máximo é ${issue.maximum}` };
      return { message: 'Valor acima do máximo' };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido' };
      if (issue.validation === 'url') return { message: 'Endereço inválido' };
      if (issue.validation === 'uuid') return { message: 'Identificador inválido' };
      return { message: 'Formato inválido' };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Escolha uma das opções' };

    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida' };

    case z.ZodIssueCode.custom:
      // Regra escrita à mão sem mensagem. Genérica de propósito: inventar um
      // texto específico aqui seria adivinhar o que a regra queria dizer.
      return { message: 'Valor inválido' };

    default:
      return { message: ctx.defaultError };
  }
};

/**
 * Aplica o mapa. Chamada uma vez, no carregamento do aplicativo.
 *
 * Fica numa função, e não solta no módulo, para o teste conseguir afirmar que
 * ela é chamada, e para a ordem ser explícita: o mapa precisa estar no lugar
 * antes de o primeiro formulário validar.
 */
export function aplicarMensagensEmPortugues(): void {
  z.setErrorMap(mapa);
}

export { mapa as mapaDeMensagens };
