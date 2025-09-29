const databaseConfig = require('../../config/database');
const FileStatsRepository = require('./FileStatsRepository');
const MongoStatsRepository = require('./MongoStatsRepository');
const WordFileRepository = require('./WordFileRepository');
const MongoWordRepository = require('./MongoWordRepository');
const InMemoryGameRepository = require('./InMemoryGameRepository');
const path = require('path');

/**
 * Фабрика репозиториев для переключения между файловой системой и MongoDB
 */
class RepositoryFactory {
  constructor() {
    this.statsRepository = null;
    this.wordRepository = null;
    this.gameRepository = null;
  }

  /**
   * Создает репозиторий статистики
   */
  createStatsRepository(baseDir = null) {
    if (this.statsRepository) {
      return this.statsRepository;
    }

    try {
      if (databaseConfig.shouldUseMongoForStats()) {
        console.log('📊 Используется MongoDB для статистики');
        this.statsRepository = new MongoStatsRepository();
      } else {
        console.log('📁 Используется файловая система для статистики');
        const statsDir = baseDir || path.join(__dirname, '../../public/stats');
        this.statsRepository = new FileStatsRepository(statsDir);
      }
    } catch (error) {
      console.error('❌ Ошибка создания репозитория статистики:', error.message);
      
      if (databaseConfig.isFallbackEnabled()) {
        console.log('🔄 Переключение на файловую систему (fallback)');
        const statsDir = baseDir || path.join(__dirname, '../../public/stats');
        this.statsRepository = new FileStatsRepository(statsDir);
      } else {
        throw error;
      }
    }

    return this.statsRepository;
  }

  /**
   * Создает репозиторий слов
   */
  createWordRepository(filePath = null) {
    if (this.wordRepository) {
      return this.wordRepository;
    }

    try {
      if (databaseConfig.shouldUseMongoForWords()) {
        console.log('📚 Используется MongoDB для слов');
        this.wordRepository = new MongoWordRepository();
      } else {
        console.log('📄 Используется файловая система для слов');
        const wordsFile = filePath || path.join(__dirname, '../../public/words.csv');
        this.wordRepository = new WordFileRepository(wordsFile);
      }
    } catch (error) {
      console.error('❌ Ошибка создания репозитория слов:', error.message);
      
      if (databaseConfig.isFallbackEnabled()) {
        console.log('🔄 Переключение на файловую систему (fallback)');
        const wordsFile = filePath || path.join(__dirname, '../../public/words.csv');
        this.wordRepository = new WordFileRepository(wordsFile);
      } else {
        throw error;
      }
    }

    return this.wordRepository;
  }

  /**
   * Создает репозиторий игры
   */
  createGameRepository() {
    if (this.gameRepository) {
      return this.gameRepository;
    }

    // Пока используем InMemoryGameRepository для всех случаев
    // В будущем можно добавить MongoDB версию
    console.log('🎮 Используется InMemory репозиторий для игры');
    this.gameRepository = new InMemoryGameRepository();
    
    return this.gameRepository;
  }

  /**
   * Получает текущий репозиторий статистики
   */
  getStatsRepository() {
    return this.statsRepository;
  }

  /**
   * Получает текущий репозиторий слов
   */
  getWordRepository() {
    return this.wordRepository;
  }

  /**
   * Получает текущий репозиторий игры
   */
  getGameRepository() {
    return this.gameRepository;
  }

  /**
   * Проверяет, используется ли MongoDB для статистики
   */
  isUsingMongoForStats() {
    return this.statsRepository instanceof MongoStatsRepository;
  }

  /**
   * Проверяет, используется ли MongoDB для слов
   */
  isUsingMongoForWords() {
    return this.wordRepository instanceof MongoWordRepository;
  }

  /**
   * Получает информацию о текущей конфигурации
   */
  getConfigurationInfo() {
    return {
      statsStorage: this.isUsingMongoForStats() ? 'MongoDB' : 'FileSystem',
      wordsStorage: this.isUsingMongoForWords() ? 'MongoDB' : 'FileSystem',
      gameStorage: 'InMemory',
      mongodbEnabled: databaseConfig.useMongoDB,
      fallbackEnabled: databaseConfig.isFallbackEnabled()
    };
  }
}

// Создаем singleton экземпляр
const repositoryFactory = new RepositoryFactory();

module.exports = repositoryFactory;

