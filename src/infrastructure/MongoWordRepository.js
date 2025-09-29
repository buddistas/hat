const mongoConnection = require('./MongoConnection');
const WordEntry = require('../entities/WordEntry');

/**
 * MongoDB репозиторий для работы со словами
 * Реализует тот же интерфейс, что и WordFileRepository
 */
class MongoWordRepository {
  constructor() {
    this.db = null;
    this.wordEntries = [];
    this.words = [];
    this.isLoaded = false;
  }

  /**
   * Инициализация подключения к базе данных
   */
  async _ensureConnection() {
    if (!this.db) {
      this.db = await mongoConnection.connect();
    }
    return this.db;
  }

  /**
   * Загружает слова из MongoDB
   */
  async _loadFromDatabase() {
    if (this.isLoaded) {
      return;
    }

    try {
      const db = await this._ensureConnection();
      const wordsCollection = await db.collection('words').find({}).toArray();
      
      this.wordEntries = wordsCollection.map(doc => 
        new WordEntry(doc.word, doc.category, doc.level)
      );
      this.words = this.wordEntries.map(e => e.word);
      
      console.log(`✅ Словарь загружен из MongoDB: ${this.words.length} слов`);
      this.isLoaded = true;
    } catch (error) {
      console.error('Ошибка загрузки словаря из MongoDB:', error.message);
      // Fallback к базовому словарю
      this.words = ['тест', 'слово', 'игра', 'шляпа'];
      this.wordEntries = this.words.map(w => new WordEntry(w));
      this.isLoaded = true;
    }
  }

  /**
   * Загружает все слова
   */
  async loadWords() {
    await this._loadFromDatabase();
    return this.wordEntries;
  }

  /**
   * Получает слова по фильтрам
   */
  async getWordsByFilters(filters) {
    await this._loadFromDatabase();
    
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
    const { hardPercentage = 0, ...otherFilters } = filters;
    
    // Если процент сложных слов не указан или равен 0, используем старую логику
    if (hardPercentage <= 0) {
      const pool = await this.getWordsByFilters(otherFilters);
      
      if (validCount > pool.length) {
        console.warn(`Запрошено ${validCount} слов, но в словаре только ${pool.length}. Используем все доступные слова.`);
        return [...pool];
      }
      
      // Случайный выбор слов
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, validCount);
    }
    
    // Новая логика с учетом процента сложных слов
    const hardWordsCount = Math.round((hardPercentage / 100) * validCount);
    const normalWordsCount = validCount - hardWordsCount;
    
    console.log(`Выбираем ${hardWordsCount} сложных слов (${hardPercentage}%) и ${normalWordsCount} обычных слов`);
    
    // Получаем пулы слов
    const hardPool = await this.getWordsByFilters({ ...otherFilters, levels: ['повышенный'] });
    const normalPool = await this.getWordsByFilters({ ...otherFilters, levels: ['обычный'] });
    
    const selectedWords = [];
    
    // Выбираем сложные слова
    if (hardWordsCount > 0 && hardPool.length > 0) {
      const shuffledHard = [...hardPool].sort(() => Math.random() - 0.5);
      const selectedHard = shuffledHard.slice(0, Math.min(hardWordsCount, hardPool.length));
      selectedWords.push(...selectedHard);
    }
    
    // Выбираем обычные слова
    if (normalWordsCount > 0 && normalPool.length > 0) {
      const shuffledNormal = [...normalPool].sort(() => Math.random() - 0.5);
      const selectedNormal = shuffledNormal.slice(0, Math.min(normalWordsCount, normalPool.length));
      selectedWords.push(...selectedNormal);
    }
    
    // Если не хватает слов, дополняем из общего пула
    if (selectedWords.length < validCount) {
      const allPool = await this.getWordsByFilters(otherFilters);
      const usedWords = new Set(selectedWords.map(w => w.word));
      const availableWords = allPool.filter(w => !usedWords.has(w.word));
      
      if (availableWords.length > 0) {
        const shuffledAvailable = [...availableWords].sort(() => Math.random() - 0.5);
        const needed = validCount - selectedWords.length;
        const additional = shuffledAvailable.slice(0, Math.min(needed, availableWords.length));
        selectedWords.push(...additional);
      }
    }
    
    // Перемешиваем финальный результат
    const shuffled = [...selectedWords].sort(() => Math.random() - 0.5);
    
    console.log(`Итого выбрано ${shuffled.length} слов из ${validCount} запрошенных`);
    return shuffled;
  }

  /**
   * Добавляет новое слово в словарь
   */
  async addWord(word, category, level = 'обычный') {
    const db = await this._ensureConnection();
    
    const wordData = {
      word: word.toUpperCase().trim(),
      category: category.trim(),
      level: level.trim(),
      createdAt: new Date()
    };

    try {
      await db.collection('words').insertOne(wordData);
      
      // Обновляем локальный кэш
      this.wordEntries.push(new WordEntry(wordData.word, wordData.category, wordData.level));
      this.words.push(wordData.word);
      
      console.log(`✅ Слово добавлено: ${wordData.word}`);
      return true;
    } catch (error) {
      if (error.code === 11000) { // Дубликат
        console.warn(`Слово уже существует: ${wordData.word}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * Удаляет слово из словаря
   */
  async removeWord(word) {
    const db = await this._ensureConnection();
    
    const result = await db.collection('words').deleteOne({ word: word.toUpperCase().trim() });
    
    if (result.deletedCount > 0) {
      // Обновляем локальный кэш
      this.wordEntries = this.wordEntries.filter(e => e.word !== word.toUpperCase().trim());
      this.words = this.words.filter(w => w !== word.toUpperCase().trim());
      console.log(`✅ Слово удалено: ${word}`);
      return true;
    }
    
    return false;
  }

  /**
   * Получает все категории
   */
  async getCategories() {
    const db = await this._ensureConnection();
    
    const categories = await db.collection('words').distinct('category');
    return categories.sort();
  }

  /**
   * Получает статистику словаря
   */
  async getDictionaryStats() {
    const db = await this._ensureConnection();
    
    const stats = await db.collection('words').aggregate([
      {
        $group: {
          _id: null,
          totalWords: { $sum: 1 },
          categories: { $addToSet: '$category' },
          levels: { $addToSet: '$level' }
        }
      },
      {
        $project: {
          totalWords: 1,
          totalCategories: { $size: '$categories' },
          categories: 1,
          levels: 1
        }
      }
    ]).toArray();

    const categoryStats = await db.collection('words').aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          levels: { $addToSet: '$level' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          levels: 1,
          _id: 0
        }
      },
      { $sort: { category: 1 } }
    ]).toArray();

    return {
      ...stats[0],
      categoryStats
    };
  }

  /**
   * Очищает кэш (принудительная перезагрузка)
   */
  async clearCache() {
    this.wordEntries = [];
    this.words = [];
    this.isLoaded = false;
  }
}

module.exports = MongoWordRepository;

