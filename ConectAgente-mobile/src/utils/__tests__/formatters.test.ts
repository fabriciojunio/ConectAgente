import {
  formatCPF,
  stripCPF,
  formatCEP,
  stripCEP,
  formatTelefone,
  formatCartaoSUS,
  formatDate,
  formatDateInput,
  parseDateBR,
  toDateBR,
  calcularIdade,
  generateUUID,
  titleCase,
  truncate,
  applyMask,
} from '../formatters';

describe('formatCPF', () => {
  it('formata CPF completo', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });
  it('formata CPF parcial - 4 dígitos', () => {
    expect(formatCPF('1234')).toBe('123.4');
  });
  it('formata CPF parcial - 7 dígitos', () => {
    expect(formatCPF('1234567')).toBe('123.456.7');
  });
  it('ignora caracteres não numéricos na entrada', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });
  it('limita a 11 dígitos', () => {
    expect(formatCPF('123456789012345')).toBe('123.456.789-01');
  });
  it('retorna string vazia para entrada vazia', () => {
    expect(formatCPF('')).toBe('');
  });
});

describe('stripCPF', () => {
  it('remove formatação do CPF', () => {
    expect(stripCPF('123.456.789-01')).toBe('12345678901');
  });
  it('retorna apenas dígitos', () => {
    expect(stripCPF('abc123def')).toBe('123');
  });
});

describe('formatCEP', () => {
  it('formata CEP completo', () => {
    expect(formatCEP('01310100')).toBe('01310-100');
  });
  it('formata CEP parcial', () => {
    expect(formatCEP('0131')).toBe('0131');
  });
  it('formata CEP com 6 dígitos', () => {
    expect(formatCEP('013101')).toBe('01310-1');
  });
  it('ignora formatação existente', () => {
    expect(formatCEP('01310-100')).toBe('01310-100');
  });
});

describe('stripCEP', () => {
  it('remove traço do CEP', () => {
    expect(stripCEP('01310-100')).toBe('01310100');
  });
});

describe('formatTelefone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(formatTelefone('11987654321')).toBe('(11) 98765-4321');
  });
  it('formata fixo com 10 dígitos', () => {
    expect(formatTelefone('1133334444')).toBe('(11) 3333-4444');
  });
  it('formata parcial - 3 dígitos', () => {
    expect(formatTelefone('119')).toBe('(11) 9');
  });
  it('formata parcial - 2 dígitos', () => {
    expect(formatTelefone('11')).toBe('(11');
  });
});

describe('formatCartaoSUS', () => {
  it('formata cartão SUS com 15 dígitos', () => {
    expect(formatCartaoSUS('700123456789012')).toBe('700 1234 5678 9012');
  });
  it('formata parcial', () => {
    expect(formatCartaoSUS('70012')).toBe('700 12');
  });
});

describe('formatDateInput', () => {
  it('formata data enquanto digita - 2 dígitos', () => {
    expect(formatDateInput('15')).toBe('15');
  });
  it('formata data enquanto digita - 4 dígitos', () => {
    expect(formatDateInput('1503')).toBe('15/03');
  });
  it('formata data enquanto digita - completa', () => {
    expect(formatDateInput('15031990')).toBe('15/03/1990');
  });
});

describe('parseDateBR', () => {
  it('converte DD/MM/AAAA para ISO AAAA-MM-DD', () => {
    expect(parseDateBR('15/03/1990')).toBe('1990-03-15');
  });
  it('retorna valor original se não tem 3 partes', () => {
    expect(parseDateBR('15/03')).toBe('15/03');
  });
});

describe('toDateBR', () => {
  it('converte AAAA-MM-DD para DD/MM/AAAA', () => {
    expect(toDateBR('1990-03-15')).toBe('15/03/1990');
  });
  it('retorna string vazia para entrada vazia', () => {
    expect(toDateBR('')).toBe('');
  });
});

describe('calcularIdade', () => {
  it('calcula idade corretamente', () => {
    const hoje = new Date();
    const anoNascimento = hoje.getFullYear() - 30;
    const dataNasc = `${anoNascimento}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    expect(calcularIdade(dataNasc)).toBe(30);
  });
  it('retorna 0 para data vazia', () => {
    expect(calcularIdade('')).toBe(0);
  });
  it('leva em conta aniversário não ocorrido no ano', () => {
    const hoje = new Date();
    const anoNascimento = hoje.getFullYear() - 25;
    // Próximo mês - aniversário ainda não aconteceu
    const proximoMes = hoje.getMonth() + 2 > 12 ? 1 : hoje.getMonth() + 2;
    const dataNasc = `${anoNascimento}-${String(proximoMes).padStart(2, '0')}-01`;
    if (hoje.getMonth() + 2 <= 12) {
      expect(calcularIdade(dataNasc)).toBe(24);
    }
  });
});

describe('generateUUID', () => {
  it('gera UUID no formato correto', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('gera UUIDs únicos', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
  });
});

describe('titleCase', () => {
  it('converte string para title case', () => {
    expect(titleCase('joao da silva')).toBe('Joao Da Silva');
  });
  it('trata maiúsculas na entrada', () => {
    expect(titleCase('MARIA JOSE')).toBe('Maria Jose');
  });
});

describe('truncate', () => {
  it('trunca string longa', () => {
    expect(truncate('String muito longa aqui', 10)).toBe('String mui...');
  });
  it('retorna string curta sem truncar', () => {
    expect(truncate('Curta', 10)).toBe('Curta');
  });
  it('retorna string com tamanho exato sem truncar', () => {
    expect(truncate('Exata', 5)).toBe('Exata');
  });
});

describe('applyMask', () => {
  it('aplica máscara corretamente', () => {
    expect(applyMask('12345678901', '999.999.999-99')).toBe('123.456.789-01');
  });
  it('para com dígitos insuficientes', () => {
    expect(applyMask('123', '999.999')).toBe('123');
  });
});
