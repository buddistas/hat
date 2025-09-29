const { MongoClient } = require('mongodb');
const databaseConfig = require('../../config/database');

/**
 * Менеджер подключения к MongoDB
 */
class MongoConnection {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * Подключается к MongoDB
   */
  async connect() {
    if (this.isConnected) {
      return this.db;
    }

    try {
      const config = databaseConfig.getMongoConfig();
      console.log(`Подключение к MongoDB: ${config.uri}`);
      
      this.client = new MongoClient(config.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await this.client.connect();
      this.db = this.client.db(config.database);
      this.isConnected = true;
      
      console.log(`✅ Подключение к MongoDB установлено: ${config.database}`);
      return this.db;
    } catch (error) {
      console.error('❌ Ошибка подключения к MongoDB:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Отключается от MongoDB
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 Отключение от MongoDB');
    }
  }

  /**
   * Получает базу данных
   */
  getDatabase() {
    if (!this.isConnected) {
      throw new Error('MongoDB не подключен. Вызовите connect() сначала.');
    }
    return this.db;
  }

  /**
   * Проверяет статус подключения
   */
  isConnectionActive() {
    return this.isConnected;
  }

  /**
   * Создает индексы для коллекций
   */
  async createIndexes() {
    if (!this.isConnected) {
      throw new Error('MongoDB не подключен');
    }

    const db = this.getDatabase();

    try {
      // Индексы для players
      await db.collection('players').createIndex({ "playerKey": 1 }, { unique: true });
      await db.collection('players').createIndex({ "telegramUserId": 1 }, { unique: true, sparse: true });
      await db.collection('players').createIndex({ "lastPlayedAt": -1 });

      // Индексы для player_stats
      await db.collection('player_stats').createIndex({ "playerKey": 1 }, { unique: true });
      await db.collection('player_stats').createIndex({ "totals.gamesPlayed": -1 });
      await db.collection('player_stats').createIndex({ "bestWinStreak": -1 });
      await db.collection('player_stats').createIndex({ "medianSpwByRound.r0": 1 });
      await db.collection('player_stats').createIndex({ "medianSpwByRound.r1": 1 });
      await db.collection('player_stats').createIndex({ "medianSpwByRound.r2": 1 });

      // Индексы для games
      await db.collection('games').createIndex({ "gameId": 1 }, { unique: true });
      await db.collection('games').createIndex({ "startedAt": -1 });
      await db.collection('games').createIndex({ "endedAt": -1 });
      await db.collection('games').createIndex({ "players.playerKey": 1 });

      // Индексы для words
      await db.collection('words').createIndex({ "word": 1 }, { unique: true });
      await db.collection('words').createIndex({ "category": 1 });
      await db.collection('words').createIndex({ "level": 1 });
      await db.collection('words').createIndex({ "category": 1, "level": 1 });

      // Индексы для leaderboards
      await db.collection('leaderboards').createIndex({ "metric": 1 }, { unique: true });
      await db.collection('leaderboards').createIndex({ "updatedAt": -1 });

      console.log('✅ Индексы MongoDB созданы');
    } catch (error) {
      console.error('❌ Ошибка создания индексов:', error.message);
      throw error;
    }
  }
}

// Создаем singleton экземпляр
const mongoConnection = new MongoConnection();

module.exports = mongoConnection;

