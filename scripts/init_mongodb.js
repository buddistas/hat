#!/usr/bin/env node

/**
 * Скрипт инициализации MongoDB для Hat Web
 * Создает базу данных, коллекции и индексы
 */

require('dotenv').config();
const mongoConnection = require('../src/infrastructure/MongoConnection');

class MongoInitializer {
  constructor() {
    this.db = null;
  }

  /**
   * Инициализация подключения к MongoDB
   */
  async initialize() {
    try {
      this.db = await mongoConnection.connect();
      console.log('✅ Подключение к MongoDB установлено');
    } catch (error) {
      console.error('❌ Ошибка подключения к MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Создание индексов
   */
  async createIndexes() {
    console.log('\n📊 Создание индексов...');
    
    try {
      await mongoConnection.createIndexes();
      console.log('✅ Индексы созданы успешно');
    } catch (error) {
      console.error('❌ Ошибка создания индексов:', error.message);
      throw error;
    }
  }

  /**
   * Проверка статуса базы данных
   */
  async checkStatus() {
    console.log('\n🔍 Проверка статуса базы данных...');
    
    try {
      const stats = await this.db.stats();
      console.log(`📊 База данных: ${stats.db}`);
      console.log(`📁 Коллекции: ${stats.collections}`);
      console.log(`📄 Документы: ${stats.objects}`);
      console.log(`💾 Размер данных: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`🗂️ Размер индексов: ${(stats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      console.error('❌ Ошибка проверки статуса:', error.message);
      throw error;
    }
  }

  /**
   * Проверка коллекций
   */
  async checkCollections() {
    console.log('\n📋 Проверка коллекций...');
    
    try {
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const expectedCollections = ['players', 'player_stats', 'games', 'game_events', 'words', 'leaderboards'];
      
      console.log('📁 Существующие коллекции:');
      collectionNames.forEach(name => {
        console.log(`   - ${name}`);
      });
      
      console.log('\n📋 Ожидаемые коллекции:');
      expectedCollections.forEach(name => {
        const exists = collectionNames.includes(name);
        console.log(`   ${exists ? '✅' : '❌'} ${name}`);
      });
      
      const missingCollections = expectedCollections.filter(name => !collectionNames.includes(name));
      if (missingCollections.length > 0) {
        console.log(`\n⚠️ Отсутствующие коллекции: ${missingCollections.join(', ')}`);
        console.log('   Они будут созданы автоматически при первом использовании');
      }
    } catch (error) {
      console.error('❌ Ошибка проверки коллекций:', error.message);
      throw error;
    }
  }

  /**
   * Проверка индексов
   */
  async checkIndexes() {
    console.log('\n🔍 Проверка индексов...');
    
    try {
      const collections = ['players', 'player_stats', 'games', 'words', 'leaderboards'];
      
      for (const collectionName of collections) {
        const collection = this.db.collection(collectionName);
        const indexes = await collection.indexes();
        
        console.log(`\n📊 Индексы для ${collectionName}:`);
        indexes.forEach(index => {
          const key = Object.keys(index.key).map(k => `${k}:${index.key[k]}`).join(', ');
          const unique = index.unique ? ' (уникальный)' : '';
          const sparse = index.sparse ? ' (разреженный)' : '';
          console.log(`   - ${index.name}: {${key}}${unique}${sparse}`);
        });
      }
    } catch (error) {
      console.error('❌ Ошибка проверки индексов:', error.message);
      throw error;
    }
  }

  /**
   * Запуск полной инициализации
   */
  async runInitialization() {
    console.log('🚀 Инициализация MongoDB для Hat Web...');
    
    try {
      await this.initialize();
      await this.createIndexes();
      await this.checkStatus();
      await this.checkCollections();
      await this.checkIndexes();
      
      console.log('\n✅ Инициализация MongoDB завершена успешно!');
      console.log('\n📋 Следующие шаги:');
      console.log('   1. Запустите миграцию данных: npm run migrate:mongodb');
      console.log('   2. Запустите сервер: npm start');
    } catch (error) {
      console.error('\n❌ Инициализация завершилась с ошибкой:', error.message);
      process.exit(1);
    } finally {
      await mongoConnection.disconnect();
    }
  }
}

// Запуск инициализации, если скрипт вызван напрямую
if (require.main === module) {
  const initializer = new MongoInitializer();
  initializer.runInitialization();
}

module.exports = MongoInitializer;

