#!/usr/bin/env node

/**
 * Скрипт миграции данных из файловой системы в MongoDB
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoConnection = require('../src/infrastructure/MongoConnection');
const WordFileRepository = require('../src/infrastructure/WordFileRepository');
const FileStatsRepository = require('../src/infrastructure/FileStatsRepository');

class DataMigrator {
  constructor() {
    this.db = null;
  }

  /**
   * Инициализация подключения к MongoDB
   */
  async initialize() {
    try {
      this.db = await mongoConnection.connect();
      await mongoConnection.createIndexes();
      console.log('✅ Подключение к MongoDB установлено');
    } catch (error) {
      console.error('❌ Ошибка подключения к MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Миграция словаря из CSV файла в MongoDB
   */
  async migrateWords() {
    console.log('\n📚 Миграция словаря...');
    
    try {
      const wordsFile = path.join(__dirname, '../public/words.csv');
      const wordRepository = new WordFileRepository(wordsFile);
      const words = await wordRepository.loadWords();
      
      console.log(`Найдено ${words.length} слов для миграции`);
      
      let migrated = 0;
      let skipped = 0;
      
      for (const wordEntry of words) {
        try {
          await this.db.collection('words').insertOne({
            word: wordEntry.word,
            category: wordEntry.category,
            level: wordEntry.level,
            createdAt: new Date()
          });
          migrated++;
        } catch (error) {
          if (error.code === 11000) { // Дубликат
            skipped++;
          } else {
            throw error;
          }
        }
      }
      
      console.log(`✅ Словарь мигрирован: ${migrated} добавлено, ${skipped} пропущено (дубликаты)`);
    } catch (error) {
      console.error('❌ Ошибка миграции словаря:', error.message);
      throw error;
    }
  }

  /**
   * Миграция статистики игроков из файлов в MongoDB
   */
  async migratePlayerStats() {
    console.log('\n👥 Миграция статистики игроков...');
    
    try {
      const statsDir = path.join(__dirname, '../public/stats');
      const playersDir = path.join(statsDir, 'players');
      
      if (!fs.existsSync(playersDir)) {
        console.log('📁 Директория игроков не найдена, пропускаем миграцию статистики');
        return;
      }
      
      const playerFiles = fs.readdirSync(playersDir).filter(f => f.endsWith('.json'));
      console.log(`Найдено ${playerFiles.length} файлов статистики игроков`);
      
      let migrated = 0;
      
      for (const file of playerFiles) {
        try {
          const filePath = path.join(playersDir, file);
          const playerData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          // Преобразуем структуру данных для MongoDB
          const mongoPlayerData = {
            playerKey: playerData.playerKey,
            displayName: playerData.displayName,
            totals: playerData.totals || {},
            perRoundSpwSamples: {
              r0: playerData.perRoundSpwSamples?.[0] || [],
              r1: playerData.perRoundSpwSamples?.[1] || [],
              r2: playerData.perRoundSpwSamples?.[2] || []
            },
            bestFirstRoundSpw: playerData.bestFirstRoundSpw,
            bestSecondRoundSpw: playerData.bestSecondRoundSpw,
            bestThirdRoundSpw: playerData.bestThirdRoundSpw,
            bestTurnByRound: {
              r0: playerData.bestTurnByRound?.[0],
              r1: playerData.bestTurnByRound?.[1],
              r2: playerData.bestTurnByRound?.[2]
            },
            maxPassedPerGame: playerData.maxPassedPerGame,
            bestWinStreak: playerData.bestWinStreak,
            currentWinStreak: playerData.currentWinStreak,
            medianSpwByRound: playerData.medianSpwByRound || {},
            lastPlayedAt: playerData.lastPlayedAt ? new Date(playerData.lastPlayedAt) : null,
            updatedAt: new Date()
          };
          
          await this.db.collection('player_stats').replaceOne(
            { playerKey: playerData.playerKey },
            mongoPlayerData,
            { upsert: true }
          );
          
          migrated++;
        } catch (error) {
          console.error(`❌ Ошибка миграции файла ${file}:`, error.message);
        }
      }
      
      console.log(`✅ Статистика игроков мигрирована: ${migrated} записей`);
    } catch (error) {
      console.error('❌ Ошибка миграции статистики игроков:', error.message);
      throw error;
    }
  }

  /**
   * Миграция лидербордов из файлов в MongoDB
   */
  async migrateLeaderboards() {
    console.log('\n🏆 Миграция лидербордов...');
    
    try {
      const statsDir = path.join(__dirname, '../public/stats');
      const leaderboardsDir = path.join(statsDir, 'leaderboards');
      
      if (!fs.existsSync(leaderboardsDir)) {
        console.log('📁 Директория лидербордов не найдена, пропускаем миграцию');
        return;
      }
      
      const leaderboardFiles = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
      console.log(`Найдено ${leaderboardFiles.length} файлов лидербордов`);
      
      let migrated = 0;
      
      for (const file of leaderboardFiles) {
        try {
          const filePath = path.join(leaderboardsDir, file);
          const leaderboardData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const metric = file.replace('.json', '');
          
          const mongoLeaderboardData = {
            metric,
            data: leaderboardData.map((item, index) => ({
              ...item,
              rank: index + 1
            })),
            updatedAt: new Date()
          };
          
          await this.db.collection('leaderboards').replaceOne(
            { metric },
            mongoLeaderboardData,
            { upsert: true }
          );
          
          migrated++;
        } catch (error) {
          console.error(`❌ Ошибка миграции лидерборда ${file}:`, error.message);
        }
      }
      
      console.log(`✅ Лидерборды мигрированы: ${migrated} записей`);
    } catch (error) {
      console.error('❌ Ошибка миграции лидербордов:', error.message);
      throw error;
    }
  }

  /**
   * Миграция игровых сессий из JSONL файлов в MongoDB
   */
  async migrateGameSessions() {
    console.log('\n🎮 Миграция игровых сессий...');
    
    try {
      const statsDir = path.join(__dirname, '../public/stats');
      const sessionsDir = path.join(statsDir, 'sessions');
      
      if (!fs.existsSync(sessionsDir)) {
        console.log('📁 Директория сессий не найдена, пропускаем миграцию');
        return;
      }
      
      const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      console.log(`Найдено ${sessionFiles.length} файлов сессий`);
      
      let migrated = 0;
      
      for (const file of sessionFiles) {
        try {
          const filePath = path.join(sessionsDir, file);
          const gameId = file.replace('.jsonl', '');
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          const events = lines.map((line, index) => {
            const event = JSON.parse(line);
            return {
              gameId,
              sequence: index + 1,
              type: event.type,
              timestamp: new Date(event.ts || Date.now()),
              data: event
            };
          });
          
          if (events.length > 0) {
            await this.db.collection('game_events').insertMany(events);
            migrated++;
          }
        } catch (error) {
          console.error(`❌ Ошибка миграции сессии ${file}:`, error.message);
        }
      }
      
      console.log(`✅ Игровые сессии мигрированы: ${migrated} сессий`);
    } catch (error) {
      console.error('❌ Ошибка миграции игровых сессий:', error.message);
      throw error;
    }
  }

  /**
   * Проверка результатов миграции
   */
  async verifyMigration() {
    console.log('\n🔍 Проверка результатов миграции...');
    
    try {
      const wordsCount = await this.db.collection('words').countDocuments();
      const playersCount = await this.db.collection('player_stats').countDocuments();
      const leaderboardsCount = await this.db.collection('leaderboards').countDocuments();
      const eventsCount = await this.db.collection('game_events').countDocuments();
      
      console.log(`📊 Результаты миграции:`);
      console.log(`   Слова: ${wordsCount}`);
      console.log(`   Игроки: ${playersCount}`);
      console.log(`   Лидерборды: ${leaderboardsCount}`);
      console.log(`   События игр: ${eventsCount}`);
      
      // Проверяем несколько примеров данных
      const sampleWord = await this.db.collection('words').findOne({});
      const samplePlayer = await this.db.collection('player_stats').findOne({});
      const sampleLeaderboard = await this.db.collection('leaderboards').findOne({});
      
      console.log('\n📋 Примеры мигрированных данных:');
      if (sampleWord) {
        console.log(`   Слово: ${sampleWord.word} (${sampleWord.category}, ${sampleWord.level})`);
      }
      if (samplePlayer) {
        console.log(`   Игрок: ${samplePlayer.displayName} (${samplePlayer.totals.gamesPlayed} игр)`);
      }
      if (sampleLeaderboard) {
        console.log(`   Лидерборд: ${sampleLeaderboard.metric} (${sampleLeaderboard.data.length} записей)`);
      }
      
    } catch (error) {
      console.error('❌ Ошибка проверки миграции:', error.message);
      throw error;
    }
  }

  /**
   * Запуск полной миграции
   */
  async runMigration() {
    console.log('🚀 Начало миграции данных в MongoDB...');
    
    try {
      await this.initialize();
      await this.migrateWords();
      await this.migratePlayerStats();
      await this.migrateLeaderboards();
      await this.migrateGameSessions();
      await this.verifyMigration();
      
      console.log('\n✅ Миграция завершена успешно!');
    } catch (error) {
      console.error('\n❌ Миграция завершилась с ошибкой:', error.message);
      process.exit(1);
    } finally {
      await mongoConnection.disconnect();
    }
  }
}

// Запуск миграции, если скрипт вызван напрямую
if (require.main === module) {
  const migrator = new DataMigrator();
  migrator.runMigration();
}

module.exports = DataMigrator;

