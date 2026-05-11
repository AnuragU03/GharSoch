import { normalizeLocation } from '../matchmaker';

describe('Matchmaker Utility', () => {
  describe('normalizeLocation', () => {
    it('should extract the first part of a location and lowercase it', () => {
      expect(normalizeLocation('Whitefield, Bangalore')).toBe('whitefield');
      expect(normalizeLocation('Whitefield')).toBe('whitefield');
      expect(normalizeLocation(' Indiranagar ')).toBe('indiranagar');
      expect(normalizeLocation('Hennur Road, Bangalore')).toBe('hennur road');
    });

    it('should handle empty or null values', () => {
      expect(normalizeLocation('')).toBe('');
      expect(normalizeLocation(undefined)).toBe('');
    });
  });
});
