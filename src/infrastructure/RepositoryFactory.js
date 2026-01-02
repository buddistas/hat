const databaseConfig = require('../../config/database');
const MongoStatsRepository = require('./MongoStatsRepository');
const MongoWordRepository = require('./MongoWordRepository');
const MongoGameRepository = require('./MongoGameRepository');
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
    if (this.statsRepository) return this.statsRepository;
    console.log('📊 Statistics repository: MongoDB (forced)');
    this.statsRepository = new MongoStatsRepository();
    return this.statsRepository;
  }

  /**
   * Создает репозиторий слов
   */
  createWordRepository(filePath = null) {
    if (this.wordRepository) return this.wordRepository;
    console.log('📚 Words repository: MongoDB (forced)');
    this.wordRepository = new MongoWordRepository();
    return this.wordRepository;
  }

  /**
   * Создает репозиторий игры
   */
  createGameRepository() {
    if (this.gameRepository) return this.gameRepository;
    console.log('🎮 Game repository: MongoDB (forced, multi-session)');
    this.gameRepository = new MongoGameRepository();
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
    return true;
  }

  /**
   * Проверяет, используется ли MongoDB для слов
   */
  isUsingMongoForWords() {
    return true;
  }

  /**
   * Получает информацию о текущей конфигурации
   */
  getConfigurationInfo() {
    return {
      statsStorage: 'MongoDB',
      wordsStorage: 'MongoDB',
      gameStorage: 'MongoDB',
      mongodbEnabled: true,
      fallbackEnabled: false
    };
  }
}

// Создаем singleton экземпляр
const repositoryFactory = new RepositoryFactory();

module.exports = repositoryFactory;

