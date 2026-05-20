import { validateId, validatePagination, validateDateRange } from '../validation';

describe('validation', () => {
  describe('validateId', () => {
    it('should accept valid UUID', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      expect(validateId(id)).toBe(id);
    });

    it('should reject invalid UUID', () => {
      expect(() => validateId('not-a-uuid')).toThrow('ID invalido');
    });

    it('should reject empty string', () => {
      expect(() => validateId('')).toThrow('ID invalido');
    });

    it('should reject SQL injection attempts', () => {
      expect(() => validateId("'; DROP TABLE users; --")).toThrow('ID invalido');
    });
  });

  describe('validatePagination', () => {
    it('should return defaults when no params', () => {
      const result = validatePagination();
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
    });

    it('should accept valid params', () => {
      const result = validatePagination({ page: 3, per_page: 50 });
      expect(result.page).toBe(3);
      expect(result.per_page).toBe(50);
    });

    it('should reject page < 1', () => {
      expect(() => validatePagination({ page: 0 })).toThrow();
    });

    it('should reject per_page > 100', () => {
      expect(() => validatePagination({ per_page: 200 })).toThrow();
    });
  });

  describe('validateDateRange', () => {
    it('should accept valid date range', () => {
      const result = validateDateRange('2024-01-01', '2024-01-31');
      expect(result.inicio).toBe('2024-01-01');
      expect(result.fim).toBe('2024-01-31');
    });

    it('should accept same date for inicio and fim', () => {
      const result = validateDateRange('2024-01-15', '2024-01-15');
      expect(result.inicio).toBe('2024-01-15');
    });

    it('should reject invalid date format', () => {
      expect(() => validateDateRange('01/01/2024', '31/01/2024')).toThrow('Data invalida');
    });

    it('should reject inicio > fim', () => {
      expect(() => validateDateRange('2024-02-01', '2024-01-01')).toThrow('Data inicial deve ser anterior');
    });
  });
});
