const fs = require('fs');
const path = require('path');
const WordEntry = require('../entities/WordEntry');

/**
 * Репозиторий для работы со словами из файла
 */
class WordFileRepository {
  constructor(filePath) {
    this.filePath = filePath;
    this.wordEntries = [];
    this.words = [];
    // Загружаем слова с диска при создании
    this._loadFromDisk();
  }

  /**
   * Парсит строку CSV
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // пропустить экранированную кавычку
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  /**
   * Загружает слова из файла (синхронно, используется только внутри конструктора)
   */
  _loadFromDisk() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const hasNewlines = raw.includes('\n');

      if (hasNewlines) {
        // Построчный формат
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
          const headerCandidate = lines[0].toLowerCase();
          let startIndex = 0;
          
          if (headerCandidate.includes('слово') || headerCandidate.includes('word')) {
            startIndex = 1;
          }
          
          const entries = [];
          for (let i = startIndex; i < lines.length; i++) {
            const cols = this.parseCSVLine(lines[i]);
            if (cols.length === 0) continue;
            
            const word = (cols[0] || '').trim();
            if (!word) continue;
            
            const category = (cols[1] || '').trim() || null;
            const level = (cols[2] || '').trim().toLowerCase() || null;
            
            entries.push(new WordEntry(word, category, level));
          }
          
          if (entries.length > 0) {
            this.wordEntries = entries;
            this.words = entries.map(e => e.word);
          }
        }
      } else {
        // Старый формат: единая строка
        const flat = raw.split(',').map(w => w.trim()).filter(w => w.length > 0);
        this.words = flat;
        this.wordEntries = flat.map(w => new WordEntry(w));
      }

      console.log(`✅ Словарь загружен: ${this.words.length} слов`);
    } catch (error) {
      console.error('Ошибка загрузки словаря:', error.message);
      this.words = ['тест', 'слово', 'игра', 'шляпа'];
      this.wordEntries = this.words.map(w => new WordEntry(w));
    }
  }

  /**
   * Загружает все слова
   */
  async loadWords() {
    return this.wordEntries;
  }

  /**
   * Получает слова по фильтрам
   */
  async getWordsByFilters(filters) {
    const { categories, levels } = filters || {};
    
    if (!Array.isArray(this.wordEntries) || this.wordEntries.length === 0) {
      return this.words.map(w => new WordEntry(w));
    }

    let pool = this.wordEntries;
    
    if (categories && categories.length > 0) {
      const categorySet = new Set(categories.map(c => String(c).trim().toLowerCase()));
      pool = pool.filter(e => e.category && categorySet.has(String(e.category).toLowerCase()));
    }
    
    if (levels && levels.length > 0) {
      const levelSet = new Set(levels.map(l => String(l).trim().toLowerCase()));
      pool = pool.filter(e => e.level && levelSet.has(String(e.level).toLowerCase()));
    }

    // Если после фильтров пусто, откатываемся к полному пулу
    if (pool.length === 0) {
      pool = this.wordEntries;
    }

    return pool;
  }

  /**
   * Выбирает случайные слова
   */
  async selectRandomWords(count, filters = {}) {
    const maxWords = 200;
    const validCount = Math.min(maxWords, count);
    
    const pool = await this.getWordsByFilters(filters);

    if (validCount > pool.length) {
      console.warn(`Запрошено ${validCount} слов, но в словаре только ${pool.length}. Используем все доступные слова.`);
      return [...pool];
    }
    
    // Случайный выбор слов
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, validCount);
  }
}

module.exports = WordFileRepository;
