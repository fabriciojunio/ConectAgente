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
const mapa: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      // `undefined` é campo não preenchido; `null` é campo limpo. Para quem
      // está olhando a tela, os dois querem dizer a mesma coisa.
      if (issue.input === undefined || issue.input === null) {
        return 'Campo obrigatório';
      }
      return 'Valor inválido';

    case 'too_small':
      if (issue.origin === 'string') {
        return Number(issue.minimum) === 1 ? 'Campo obrigatório' : `Mínimo de ${issue.minimum} caracteres`;
      }
      if (issue.origin === 'number') return `O mínimo é ${issue.minimum}`;
      if (issue.origin === 'array') return `Selecione ao menos ${issue.minimum}`;
      return 'Valor abaixo do mínimo';

    case 'too_big':
      if (issue.origin === 'string') return `Máximo de ${issue.maximum} caracteres`;
      if (issue.origin === 'number') return `O máximo é ${issue.maximum}`;
      return 'Valor acima do máximo';

    case 'invalid_format':
      if (issue.format === 'email') return 'E-mail inválido';
      if (issue.format === 'url') return 'Endereço inválido';
      if (issue.format === 'uuid' || issue.format === 'guid') return 'Identificador inválido';
      return 'Formato inválido';

    case 'invalid_value':
      return 'Escolha uma das opções';

    case 'custom':
      // Regra escrita à mão sem mensagem. Genérica de propósito: inventar um
      // texto específico aqui seria adivinhar o que a regra queria dizer.
      return 'Valor inválido';

    default:
      // Sem resposta aqui, o Zod usa a própria mensagem padrão.
      return undefined;
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
  z.config({ customError: mapa });
}

export { mapa as mapaDeMensagens };
