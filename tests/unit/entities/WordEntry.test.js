const WordEntry = require('../../../src/entities/WordEntry');

describe('WordEntry', () => {
  test('should create word entry with correct properties', () => {
    const entry = new WordEntry('тест', 'животные', 'обычный');
    
    expect(entry.word).toBe('тест');
    expect(entry.category).toBe('животные');
    expect(entry.level).toBe('обычный');
  });

  test('should create word entry with default values', () => {
    const entry = new WordEntry('тест');
    
    expect(entry.word).toBe('тест');
    expect(entry.category).toBe(null);
    expect(entry.level).toBe(null);
  });

  test('should normalize word correctly', () => {
    expect(WordEntry.normalizeWord('  Тест!  ')).toBe('тест');
    expect(WordEntry.normalizeWord('ёлка')).toBe('елка');
    expect(WordEntry.normalizeWord('кошка, собака')).toBe('кошка собака');
    expect(WordEntry.normalizeWord('много    пробелов')).toBe('много пробелов');
  });

  test('should match filters correctly', () => {
    const entry = new WordEntry('кошка', 'животные', 'обычный');
    
    // No filters
    expect(entry.matchesFilters()).toBe(true);
    
    // Category filter
    expect(entry.matchesFilters(['животные'])).toBe(true);
    expect(entry.matchesFilters(['растения'])).toBe(false);
    expect(entry.matchesFilters(['ЖИВОТНЫЕ'])).toBe(true); // Case insensitive
    
    // Level filter
    expect(entry.matchesFilters(null, ['обычный'])).toBe(true);
    expect(entry.matchesFilters(null, ['повышенный'])).toBe(false);
    expect(entry.matchesFilters(null, ['ОБЫЧНЫЙ'])).toBe(true); // Case insensitive
    
    // Both filters
    expect(entry.matchesFilters(['животные'], ['обычный'])).toBe(true);
    expect(entry.matchesFilters(['растения'], ['обычный'])).toBe(false);
    expect(entry.matchesFilters(['животные'], ['повышенный'])).toBe(false);
  });

  test('should clone word entry correctly', () => {
    const original = new WordEntry('тест', 'категория', 'уровень');
    const cloned = original.clone();
    
    expect(cloned).not.toBe(original);
    expect(cloned.word).toBe(original.word);
    expect(cloned.category).toBe(original.category);
    expect(cloned.level).toBe(original.level);
  });

  test('should check equality correctly', () => {
    const entry1 = new WordEntry('тест', 'категория', 'уровень');
    const entry2 = new WordEntry('тест', 'категория', 'уровень');
    const entry3 = new WordEntry('другой', 'категория', 'уровень');
    
    expect(entry1.equals(entry2)).toBe(true);
    expect(entry1.equals(entry3)).toBe(false);
    expect(entry1.equals(null)).toBe(false);
  });
});
