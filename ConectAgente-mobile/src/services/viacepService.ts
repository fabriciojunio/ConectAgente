export interface EnderecoViaCEP {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  erro?: boolean;
}

export async function buscarEnderecoPorCEP(cep: string): Promise<EnderecoViaCEP> {
  const cepLimpo = cep.replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    throw new Error('CEP inválido — deve conter 8 dígitos');
  }

  const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

  if (!response.ok) {
    throw new Error('Erro ao consultar ViaCEP');
  }

  const data: EnderecoViaCEP = await response.json();

  if (data.erro) {
    throw new Error('CEP não encontrado');
  }

  return data;
}
