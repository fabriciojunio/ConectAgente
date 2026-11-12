import {
  lerProblemas, medicamentoSchema, respostaSchema, rotuloDoProblema, rotuloDoProfissional,
  serializarProblemas, situacaoDaDuvida,
} from '../regras';

describe('problemas de uso', () => {
  it('grava só valores conhecidos, sem repetir', () => {
    expect(serializarProblemas(['esquece', 'esquece', 'automedicacao', 'inventado'])).toBe('esquece,automedicacao');
  });

  it('lista vazia vira nulo, e não texto vazio', () => {
    expect(serializarProblemas([])).toBeNull();
    expect(serializarProblemas(['inventado'])).toBeNull();
  });

  it('lê de volta e descarta o que não reconhece', () => {
    expect(lerProblemas('esquece, armazenamento,xyz')).toEqual(['esquece', 'armazenamento']);
    expect(lerProblemas(null)).toEqual([]);
    expect(lerProblemas('')).toEqual([]);
  });

  it('mostra o rótulo em português', () => {
    expect(rotuloDoProblema('efeito_colateral')).toBe('Relata efeito colateral');
    expect(rotuloDoProfissional('farmaceutico')).toBe('Farmacêutico(a)');
    expect(rotuloDoProfissional(null)).toBe('equipe');
  });
});

describe('situação da dúvida', () => {
  it('sem dúvida, aguardando e respondida', () => {
    expect(situacaoDaDuvida({ duvida: null })).toBe('sem_duvida');
    expect(situacaoDaDuvida({ duvida: '   ' })).toBe('sem_duvida');
    expect(situacaoDaDuvida({ duvida: 'Pode tomar com café?', duvida_respondida: false })).toBe('aguardando');
    expect(situacaoDaDuvida({ duvida: 'Pode tomar com café?', duvida_respondida: true })).toBe('respondida');
  });
});

describe('validação do medicamento', () => {
  it('exige nome e limpa os opcionais vazios', () => {
    const r = medicamentoSchema.safeParse({ nome: '  Losartana ', dosagem: '', frequencia: ' ', duvida: '' });
    expect(r.success && r.data).toEqual({ nome: 'Losartana', dosagem: undefined, frequencia: undefined, duvida: undefined });
  });

  it('recusa nome curto e textos longos demais', () => {
    expect(medicamentoSchema.safeParse({ nome: 'A' }).success).toBe(false);
    expect(medicamentoSchema.safeParse({ nome: 'Losartana', duvida: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('validação da resposta', () => {
  it('exige quem respondeu e o texto', () => {
    expect(respostaSchema.safeParse({ respondido_por: 'enfermeiro', resposta: 'Tomar após o café.' }).success).toBe(true);
    const semProfissional = respostaSchema.safeParse({ resposta: 'Tomar após o café.' });
    expect(semProfissional.success).toBe(false);
    expect(semProfissional.error?.issues[0].message).toBe('Escolha quem respondeu');
    expect(respostaSchema.safeParse({ respondido_por: 'vizinho', resposta: 'ok ok' }).success).toBe(false);
    expect(respostaSchema.safeParse({ respondido_por: 'medico', resposta: ' ' }).success).toBe(false);
  });
});
