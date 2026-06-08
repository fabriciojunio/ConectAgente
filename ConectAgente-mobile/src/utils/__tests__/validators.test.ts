import {
  validarCPF,
  validarCartaoSUS,
  validarCEP,
  validarEmail,
  validarTelefone,
  validarData,
  validarDataBR,
  validarDataNascimento,
  escapeForLike,
  loginSchema,
  residenciaSchema,
  moradorSchema,
} from '../validators';

describe('validarCPF', () => {
  it('valida CPF válido', () => {
    expect(validarCPF('52998224725')).toBe(true);
  });
  it('rejeita CPF com todos dígitos iguais', () => {
    expect(validarCPF('11111111111')).toBe(false);
    expect(validarCPF('00000000000')).toBe(false);
  });
  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(validarCPF('1234567890')).toBe(false);
  });
  it('rejeita CPF com dígito verificador errado', () => {
    expect(validarCPF('12345678900')).toBe(false);
  });
  it('aceita CPF com formatação (pontos e traço)', () => {
    expect(validarCPF('529.982.247-25')).toBe(true);
  });
  it('rejeita CPF vazio', () => {
    expect(validarCPF('')).toBe(false);
  });
});

describe('validarCartaoSUS', () => {
  it('valida cartão SUS com 15 dígitos', () => {
    expect(validarCartaoSUS('700123456789012')).toBe(true);
  });
  it('rejeita cartão com menos de 15 dígitos', () => {
    expect(validarCartaoSUS('7001234567890')).toBe(false);
  });
  it('rejeita cartão com mais de 15 dígitos', () => {
    expect(validarCartaoSUS('7001234567890123')).toBe(false);
  });
  it('aceita cartão formatado com espaços', () => {
    expect(validarCartaoSUS('700 1234 5678 9012')).toBe(true);
  });
});

describe('validarCEP', () => {
  it('valida CEP com 8 dígitos', () => {
    expect(validarCEP('01310100')).toBe(true);
  });
  it('valida CEP formatado', () => {
    expect(validarCEP('01310-100')).toBe(true);
  });
  it('rejeita CEP com menos de 8 dígitos', () => {
    expect(validarCEP('0131010')).toBe(false);
  });
  it('rejeita CEP vazio', () => {
    expect(validarCEP('')).toBe(false);
  });
});

describe('validarEmail', () => {
  it('valida email correto', () => {
    expect(validarEmail('joao@prefeitura.gov.br')).toBe(true);
  });
  it('valida email com subdomínio', () => {
    expect(validarEmail('agente@ubs.saude.sp.gov.br')).toBe(true);
  });
  it('rejeita email sem @', () => {
    expect(validarEmail('joaoprefeitura.gov.br')).toBe(false);
  });
  it('rejeita email sem domínio', () => {
    expect(validarEmail('joao@')).toBe(false);
  });
  it('rejeita email com TLD de 1 caractere', () => {
    expect(validarEmail('joao@teste.c')).toBe(false);
  });
  it('aceita email com espaços nas bordas (trim interno)', () => {
    expect(validarEmail('  joao@teste.com  ')).toBe(true);
  });
  it('rejeita email vazio', () => {
    expect(validarEmail('')).toBe(false);
  });
  it('rejeita email sem extensão de domínio', () => {
    expect(validarEmail('joao@dominio')).toBe(false);
  });
});

describe('escapeForLike', () => {
  it('retorna string sem metacaracteres inalterada', () => {
    expect(escapeForLike('João Silva')).toBe('João Silva');
  });

  it('escapa %', () => {
    expect(escapeForLike('50% desconto')).toBe('50\\% desconto');
  });

  it('escapa _', () => {
    expect(escapeForLike('campo_nome')).toBe('campo\\_nome');
  });

  it('escapa \\ (barra invertida)', () => {
    expect(escapeForLike('C:\\pasta')).toBe('C:\\\\pasta');
  });

  it('escapa múltiplos metacaracteres', () => {
    expect(escapeForLike('100% do_total')).toBe('100\\% do\\_total');
  });

  it('retorna string vazia inalterada', () => {
    expect(escapeForLike('')).toBe('');
  });

  it('não escapa caracteres normais de busca', () => {
    expect(escapeForLike('Maria José')).toBe('Maria José');
  });
});

describe('validarTelefone', () => {
  it('valida celular com 11 dígitos', () => {
    expect(validarTelefone('11987654321')).toBe(true);
  });
  it('valida fixo com 10 dígitos', () => {
    expect(validarTelefone('1133334444')).toBe(true);
  });
  it('rejeita telefone com 9 dígitos', () => {
    expect(validarTelefone('119876543')).toBe(false);
  });
  it('aceita telefone formatado', () => {
    expect(validarTelefone('(11) 9876-54321')).toBe(true);
  });
});

describe('validarData', () => {
  it('valida data ISO válida', () => {
    expect(validarData('2024-03-15')).toBe(true);
  });
  it('rejeita string inválida', () => {
    expect(validarData('não-é-data')).toBe(false);
  });
  it('rejeita string vazia', () => {
    expect(validarData('')).toBe(false);
  });
});

describe('validarDataBR', () => {
  it('valida data BR válida', () => {
    expect(validarDataBR('15/03/1990')).toBe(true);
  });
  it('rejeita mês inválido', () => {
    expect(validarDataBR('15/13/1990')).toBe(false);
  });
  it('rejeita dia inválido', () => {
    expect(validarDataBR('32/03/1990')).toBe(false);
  });
  it('rejeita ano muito antigo', () => {
    expect(validarDataBR('15/03/1800')).toBe(false);
  });
  it('rejeita formato errado', () => {
    expect(validarDataBR('1990-03-15')).toBe(false);
  });
});

describe('validarDataNascimento', () => {
  it('valida data de nascimento passada válida', () => {
    expect(validarDataNascimento('15/03/1990')).toBe(true);
  });

  it('rejeita data futura', () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = String(amanha.getDate()).padStart(2, '0');
    const mes = String(amanha.getMonth() + 1).padStart(2, '0');
    const ano = amanha.getFullYear();
    expect(validarDataNascimento(`${dia}/${mes}/${ano}`)).toBe(false);
  });

  it('aceita data de hoje', () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    expect(validarDataNascimento(`${dia}/${mes}/${ano}`)).toBe(true);
  });

  it('rejeita data em formato inválido', () => {
    expect(validarDataNascimento('1990-03-15')).toBe(false);
    expect(validarDataNascimento('99/99/9999')).toBe(false);
    expect(validarDataNascimento('')).toBe(false);
  });

  it('rejeita data com mês inválido', () => {
    expect(validarDataNascimento('15/13/1990')).toBe(false);
  });
});

describe('loginSchema (Zod)', () => {
  it('valida dados de login válidos', () => {
    const result = loginSchema.safeParse({ cpf: '52998224725', senha: 'senha123' });
    expect(result.success).toBe(true);
  });
  it('rejeita senha muito curta', () => {
    const result = loginSchema.safeParse({ cpf: '52998224725', senha: '12' });
    expect(result.success).toBe(false);
  });
  it('rejeita CPF inválido', () => {
    const result = loginSchema.safeParse({ cpf: '12345678900', senha: 'senha123' });
    expect(result.success).toBe(false);
  });
  it('rejeita CPF ausente', () => {
    const result = loginSchema.safeParse({ senha: 'senha123' });
    expect(result.success).toBe(false);
  });
});

describe('residenciaSchema (Zod)', () => {
  const dadosValidos = {
    cep: '01310100',
    logradouro: 'Rua das Flores',
    numero: '123',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    tipo_imovel: 'proprio' as const,
    num_comodos: 4,
    tem_animais: false,
  };

  it('valida residência com dados válidos', () => {
    const result = residenciaSchema.safeParse(dadosValidos);
    expect(result.success).toBe(true);
  });
  it('rejeita CEP inválido', () => {
    const result = residenciaSchema.safeParse({ ...dadosValidos, cep: '1234' });
    expect(result.success).toBe(false);
  });
  it('rejeita estado com mais de 2 letras', () => {
    const result = residenciaSchema.safeParse({ ...dadosValidos, estado: 'SAO' });
    expect(result.success).toBe(false);
  });
  it('rejeita tipo_imovel inválido', () => {
    const result = residenciaSchema.safeParse({ ...dadosValidos, tipo_imovel: 'invalido' });
    expect(result.success).toBe(false);
  });
  it('rejeita num_comodos menor que 1', () => {
    const result = residenciaSchema.safeParse({ ...dadosValidos, num_comodos: 0 });
    expect(result.success).toBe(false);
  });
});

describe('moradorSchema (Zod)', () => {
  const dadosValidos = {
    residencia_id: '550e8400-e29b-41d4-a716-446655440000',
    nome: 'João da Silva',
    data_nascimento: '15/03/1990',
    sexo: 'masculino' as const,
    tem_doenca: false,
    beneficio_bolsa_familia: false,
    tem_convenio: false,
    toma_medicamento: false,
    is_responsavel: false,
  };

  it('valida morador com dados mínimos obrigatórios', () => {
    const result = moradorSchema.safeParse(dadosValidos);
    expect(result.success).toBe(true);
  });

  it('rejeita data de nascimento futura', () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dia = String(amanha.getDate()).padStart(2, '0');
    const mes = String(amanha.getMonth() + 1).padStart(2, '0');
    const ano = amanha.getFullYear();
    const result = moradorSchema.safeParse({
      ...dadosValidos,
      data_nascimento: `${dia}/${mes}/${ano}`,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita CPF inválido quando fornecido', () => {
    const result = moradorSchema.safeParse({ ...dadosValidos, cpf: '12345678900' });
    expect(result.success).toBe(false);
  });

  it('aceita CPF válido', () => {
    const result = moradorSchema.safeParse({ ...dadosValidos, cpf: '52998224725' });
    expect(result.success).toBe(true);
  });

  it('rejeita sexo inválido', () => {
    const result = moradorSchema.safeParse({ ...dadosValidos, sexo: 'invalido' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome muito curto', () => {
    const result = moradorSchema.safeParse({ ...dadosValidos, nome: 'A' });
    expect(result.success).toBe(false);
  });
});
