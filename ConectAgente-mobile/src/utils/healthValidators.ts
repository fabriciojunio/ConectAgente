export function validarCartaoSUS(cartao: string): boolean {
  const numeros = cartao.replace(/\D/g, '');
  if (numeros.length !== 15) return false;

  // Dígito verificador do Cartão Nacional de Saúde
  const pesos = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = numeros
    .slice(0, 14)
    .split('')
    .reduce((acc, digito, i) => acc + parseInt(digito) * pesos[i], 0);

  const resto = soma % 11;
  const digVerificador = resto < 2 ? 0 : 11 - resto;

  return digVerificador === parseInt(numeros[14]);
}

export function validarIdadeMinima(dataNascimento: string, idadeMinima: number): boolean {
  const nascimento = new Date(dataNascimento);
  if (isNaN(nascimento.getTime())) return false;

  const hoje = new Date();
  const idade = hoje.getFullYear() - nascimento.getFullYear();
  const ajuste =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())
      ? 1
      : 0;

  return idade - ajuste >= idadeMinima;
}

export function validarPressaoArterial(valor: string): boolean {
  return /^\d{2,3}\/\d{2,3}$/.test(valor);
}
