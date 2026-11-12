import { preencherFormulario } from '../conversoes';

const PADRAO = { is_gestante: false, semanas_gestacao: '', data_dum: '', observacoes: '' };

describe('preencherFormulario', () => {
  it('sem registro gravado, devolve o padrão inteiro', () => {
    expect(preencherFormulario(PADRAO, null)).toEqual(PADRAO);
    expect(preencherFormulario(PADRAO, undefined)).toEqual(PADRAO);
  });

  it('carrega o que está gravado, convertendo número em texto', () => {
    const r = preencherFormulario(PADRAO, { is_gestante: true, semanas_gestacao: 23, data_dum: '01/06/2026' });
    expect(r).toEqual({ is_gestante: true, semanas_gestacao: '23', data_dum: '01/06/2026', observacoes: '' });
  });

  it('nulo do banco vira vazio, e não o texto de outro morador', () => {
    const r = preencherFormulario(PADRAO, { is_gestante: 0, observacoes: null });
    expect(r).toEqual(PADRAO);
  });

  it('ignora coluna do banco que não é campo da tela', () => {
    const r = preencherFormulario(PADRAO, { id: 'x', prontuario_id: 'y', updated_at: 'z' });
    expect(r).toEqual(PADRAO);
    expect(r).not.toHaveProperty('id');
  });

  it('não altera o padrão recebido', () => {
    preencherFormulario(PADRAO, { is_gestante: true });
    expect(PADRAO.is_gestante).toBe(false);
  });
});
