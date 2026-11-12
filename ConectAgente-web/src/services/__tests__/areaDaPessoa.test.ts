import { areaDaPessoa } from '../unidadeService';

describe('área mostrada na tabela de equipe', () => {
  it('não repete a microárea que já está no nome da área', () => {
    expect(areaDaPessoa({ area_atuacao: 'Microárea 001', microarea: '001' })).toBe('Microárea 001');
  });
  it('junta área e microárea quando são diferentes', () => {
    expect(areaDaPessoa({ area_atuacao: 'Jardim Europa', microarea: '07' })).toBe('Jardim Europa · microárea 07');
  });
  it('sem nada, mostra traço', () => {
    expect(areaDaPessoa({ area_atuacao: '', microarea: null })).toBe('—');
  });
});
