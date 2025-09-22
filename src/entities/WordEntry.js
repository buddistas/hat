/**
 * Сущность записи слова
 */
class WordEntry {
  constructor(word, category = null, level = null) {
    this.word = word;
    this.category = category;
    this.level = level;
  }

  /**
   * Нормализует слово для сравнения
   */
  static normalizeWord(word) {
    return word
      .toLowerCase()
      .trim()
      .replace(/ё/g, 'е')
      .replace(/[.,!?:;"'()\-–—]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Проверяет, соответствует ли слово фильтрам
   */
  matchesFilters(categories = null, levels = null) {
    if (categories && categories.length > 0) {
      const categorySet = new Set(categories.map(c => String(c).trim().toLowerCase()));
      if (!this.category || !categorySet.has(String(this.category).toLowerCase())) {
        return false;
      }
    }

    if (levels && levels.length > 0) {
      const levelSet = new Set(levels.map(l => String(l).trim().toLowerCase()));
      if (!this.level || !levelSet.has(String(this.level).toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Создает копию записи слова
   */
  clone() {
    return new WordEntry(this.word, this.category, this.level);
  }

  /**
   * Проверяет равенство записей слов
   */
  equals(other) {
    return other ? 
           (this.word === other.word && 
            this.category === other.category && 
            this.level === other.level) : false;
  }
}

module.exports = WordEntry;
