require('dotenv').config();

/**
 * Конфигурация базы данных
 */
class DatabaseConfig {
  constructor() {
    this.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hat_game';
    this.mongodbDatabase = process.env.MONGODB_DATABASE || 'hat_game';
    this.useMongoDB = process.env.USE_MONGODB === 'true';
    this.statsStorageType = process.env.STATS_STORAGE_TYPE || 'filesystem';
    this.wordsStorageType = process.env.WORDS_STORAGE_TYPE || 'filesystem';
    this.fallbackToFilesystem = process.env.FALLBACK_TO_FILESYSTEM === 'true';
  }

  /**
   * Проверяет, нужно ли использовать MongoDB для статистики
   */
  shouldUseMongoForStats() {
    return this.useMongoDB && this.statsStorageType === 'mongodb';
  }

  /**
   * Проверяет, нужно ли использовать MongoDB для слов
   */
  shouldUseMongoForWords() {
    return this.useMongoDB && this.wordsStorageType === 'mongodb';
  }

  /**
   * Получает конфигурацию MongoDB
   */
  getMongoConfig() {
    return {
      uri: this.mongodbUri,
      database: this.mongodbDatabase
    };
  }

  /**
   * Проверяет, включен ли fallback на файловую систему
   */
  isFallbackEnabled() {
    return this.fallbackToFilesystem;
  }
}

module.exports = new DatabaseConfig();

