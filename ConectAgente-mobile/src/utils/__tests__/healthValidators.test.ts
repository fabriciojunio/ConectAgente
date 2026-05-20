import {
  validarCartaoSUS,
  validarIdadeMinima,
  validarPressaoArterial,
} from '../healthValidators';

describe('healthValidators', () => {
  describe('validarCartaoSUS', () => {
    it('deve rejeitar cartao com menos de 15 digitos', () => {
      expect(validarCartaoSUS('12345678901234')).toBe(false);
    });

    it('deve rejeitar cartao com caracteres nao numericos apos limpeza', () => {
      expect(validarCartaoSUS('abc')).toBe(false);
    });
  });

  describe('validarIdadeMinima', () => {
    it('deve aprovar adulto com 18 anos', () => {
      const nascimento = new Date();
      nascimento.setFullYear(nascimento.getFullYear() - 20);
      expect(validarIdadeMinima(nascimento.toISOString().split('T')[0], 18)).toBe(true);
    });

    it('deve rejeitar data invalida', () => {
      expect(validarIdadeMinima('data-invalida', 18)).toBe(false);
    });

    it('deve rejeitar menor de 18 anos', () => {
      const nascimento = new Date();
      nascimento.setFullYear(nascimento.getFullYear() - 10);
      expect(validarIdadeMinima(nascimento.toISOString().split('T')[0], 18)).toBe(false);
    });
  });

  describe('validarPressaoArterial', () => {
    it('deve validar formato correto', () => {
      expect(validarPressaoArterial('120/80')).toBe(true);
      expect(validarPressaoArterial('140/90')).toBe(true);
    });

    it('deve rejeitar formato invalido', () => {
      expect(validarPressaoArterial('120-80')).toBe(false);
      expect(validarPressaoArterial('pressao')).toBe(false);
    });
  });
});
