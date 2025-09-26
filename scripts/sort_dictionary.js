#!/usr/bin/env node

/**
 * Единый скрипт для сортировки словаря
 * 
 * Использование:
 *   node scripts/sort_dictionary.js
 * 
 * Функции:
 * - Нормализация слов (верхний регистр, схлопывание пробелов, нормализация тире и апострофов)
 * - Удаление дубликатов по полной записи (слово+категория+уровень)
 * - Сортировка по категории, затем по слову (русская колляция)
 * - Создание бэкапа перед изменениями
 * - Валидация категорий и уровней
 * - Подробная статистика
 * 
 * Правила сортировки (из ProjectPlan.md, раздел 12.1):
 * - Формат CSV: слово,категория,уровень
 * - Сортировка: сначала по категории (алфавит ru, sensitivity=base), затем по слову (алфавит ru, sensitivity=base)
 * - Уровень (обычный/повышенный) не влияет на порядок сортировки
 * - При записи соблюдается верхний регистр только для колонки «слово»
 * 
 * Нормализация (из ProjectPlan.md, раздел 9):
 * - Регистр: слова фиксируются В ВЕРХНЕМ РЕГИСТРЕ
 * - Кириллица: upperCase → trim → нормализация пробелов → нормализация тире (– — − → -) и апострофов (' ` ´ → ')
 * - «Ё» при сортировке приравнивается к «Е» (колляция ru, sensitivity=base)
 * - Дедуп-линия: точные дубли записей (слово+категория+уровень после нормализации) удаляются
 */

const fs = require('fs');
const path = require('path');

// Константы
const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');
const ALLOWED_LEVELS = new Set(['', 'обычный', 'повышенный']);
const ALLOWED_CATEGORIES = new Set([
  'Флора и фауна',
  'Знаменитости',
  'Природные явления',
  'География',
  'Техника',
  'Вещи и предметы быта',
  'Продукты питания и кулинария',
  'Материалы и вещества',
  'Развлечения и хобби',
  'Спорт и фитнес',
  'Профессии и должности',
  'Общество и бюрократия',
  'Здоровье и медицина',
  'Праздники, обычаи и традиции',
  'Цифровые продукты',
  'Фильмы и сериалы',
  'Книги и литература',
  'Фразеологизмы, пословицы и поговорки',
  'История',
  'Архитектура и городская среда',
  'Бренды и торговые марки',
  'Музыка',
  'Эмоции и черты характера',
  'Наука и технологии',
  'Медиа'
]);

/**
 * Парсинг CSV строки с поддержкой кавычек
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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
 * Создание CSV строки с экранированием
 */
function csvJoin(fields) {
  return fields
    .map((f) => {
      if (f == null) return '';
      const needsQuotes = /[",\n]/.test(f);
      let val = String(f).replace(/"/g, '""');
      return needsQuotes ? `"${val}"` : val;
    })
    .join(',');
}

/**
 * Нормализация тире и апострофов
 */
function normalizeHyphensAndApostrophes(str) {
  if (!str) return str;
  return str
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // hyphens/dashes → -
    .replace(/[\u2018\u2019\u02BC\u2032\u00B4\u0060]/g, "'"); // apostrophes/prime/grave/acute → '
}

/**
 * Схлопывание пробелов
 */
function collapseSpaces(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

/**
 * Нормализация слова в верхний регистр
 */
function normalizeWordToUpper(str) {
  let s = String(str || '');
  s = normalizeHyphensAndApostrophes(s);
  s = collapseSpaces(s);
  // Uppercase using default locale; Node uses ICU; this handles Cyrillic
  s = s.toUpperCase();
  return s;
}

/**
 * Нормализация для дедупликации (включая ё→е)
 */
function normalizeForDedup(word) {
  if (!word) return '';
  return normalizeWordToUpper(word)
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'Е');
}

/**
 * Создание бэкапа файла
 */
function createBackup(originalContent) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T');
  const backupName = `words_backup_${timestamp}.csv`;
  const backupPath = path.join(__dirname, '..', 'public', backupName);
  
  fs.writeFileSync(backupPath, originalContent, 'utf8');
  console.log(`✅ Создан бэкап: ${path.relative(process.cwd(), backupPath)}`);
  
  return backupPath;
}

/**
 * Валидация записей
 */
function validateEntries(entries) {
  const errors = [];
  const seenKeys = new Set();
  
  entries.forEach((entry, idx) => {
    const { word, category, level } = entry;
    
    // Проверка дубликатов по полной записи (слово+категория+уровень)
    const key = `${word}|${category}|${level}`;
    if (seenKeys.has(key)) {
      errors.push(`Дубликат записи: "${word}" (${category}, ${level}) @${idx + 1}`);
    } else {
      seenKeys.add(key);
    }
    
    // Проверка уровня
    if (level && !ALLOWED_LEVELS.has(level)) {
      errors.push(`Неизвестный уровень: "${level}" @${idx + 1}`);
    }
    
    // Проверка категории
    if (category && !ALLOWED_CATEGORIES.has(category)) {
      errors.push(`Неизвестная категория: "${category}" @${idx + 1}`);
    }
  });
  
  return errors;
}

/**
 * Основная функция сортировки
 */
function sortDictionary() {
  console.log('🔄 Начинаем сортировку словаря...');
  
  // Проверка существования файла
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ Файл public/words.csv не найден');
    process.exit(1);
  }
  
  // Чтение файла
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  
  if (lines.length === 0) {
    console.log('⚠️  Файл пуст');
    return;
  }
  
  // Определение заголовка
  const headerPresent = lines.length > 0 && /\b(слово|word)\b/i.test(lines[0]);
  const startIndex = headerPresent ? 1 : 0;
  const headerLine = headerPresent ? lines[0] : null;
  
  console.log(`📋 Заголовок ${headerPresent ? 'найден' : 'не найден'}`);
  
  // Парсинг записей
  const records = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;
    
    const cols = parseCSVLine(rawLine.trim());
    if (cols.length === 0) continue;
    
    const word = collapseSpaces(cols[0] || '');
    const category = collapseSpaces(cols[1] || '');
    const level = collapseSpaces(cols[2] || '');
    
    if (!word) continue; // пропускаем пустые строки
    
    records.push({ word, category, level });
  }
  
  console.log(`📊 Найдено ${records.length} записей`);
  
  // Валидация (пропускаем дубликаты для тестирования)
  const errors = validateEntries(records);
  const duplicateErrors = errors.filter(err => err.includes('Дубликат записи'));
  const otherErrors = errors.filter(err => !err.includes('Дубликат записи'));
  
  if (otherErrors.length > 0) {
    console.error(`❌ Ошибки валидации (${otherErrors.length}):`);
    otherErrors.slice(0, 10).forEach(err => console.error(`   - ${err}`));
    if (otherErrors.length > 10) {
      console.error(`   ...и еще ${otherErrors.length - 10} ошибок`);
    }
    process.exit(2);
  }
  
  if (duplicateErrors.length > 0) {
    console.log(`⚠️  Найдено ${duplicateErrors.length} дубликатов (будут удалены при сортировке)`);
  }
  
  // Нормализация
  console.log('🔧 Нормализация записей...');
  for (const record of records) {
    record.word = normalizeWordToUpper(record.word);
    record.category = normalizeHyphensAndApostrophes(collapseSpaces(record.category));
    record.level = normalizeHyphensAndApostrophes(collapseSpaces(record.level.toLowerCase())) || '';
  }
  
  // Дедупликация по полной записи (слово+категория+уровень)
  console.log('🔍 Удаление дубликатов...');
  const seenKeys = new Set();
  const deduped = [];
  
  for (const record of records) {
    const key = `${record.word}|${record.category}|${record.level}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(record);
    }
  }
  
  const removedCount = records.length - deduped.length;
  if (removedCount > 0) {
    console.log(`🗑️  Удалено ${removedCount} дубликатов`);
  }
  
  // Сортировка: сначала по категории, затем по слову
  console.log('📚 Сортировка по категории и слову...');
  const collator = new Intl.Collator('ru', { sensitivity: 'base' });
  
  deduped.sort((a, b) => {
    // Сначала по категории
    const categoryCompare = collator.compare(a.category || '', b.category || '');
    if (categoryCompare !== 0) return categoryCompare;
    
    // Затем по слову
    return collator.compare(a.word, b.word);
  });
  
  // Создание бэкапа
  createBackup(raw);
  
  // Запись результата
  console.log('💾 Запись отсортированного словаря...');
  const outLines = [];
  
  if (headerPresent) {
    outLines.push(headerLine.trim());
  }
  
  for (const record of deduped) {
    outLines.push(csvJoin([record.word, record.category, record.level]));
  }
  
  fs.writeFileSync(CSV_PATH, outLines.join('\n') + '\n', 'utf8');
  
  // Статистика
  console.log('\n📈 Результат сортировки:');
  console.log(`   📝 Всего записей: ${deduped.length}`);
  console.log(`   🗑️  Удалено дубликатов: ${removedCount}`);
  console.log(`   📁 Файл: ${path.relative(process.cwd(), CSV_PATH)}`);
  
  // Статистика по категориям
  const categoryStats = {};
  for (const record of deduped) {
    const cat = record.category || 'Без категории';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  }
  
  console.log('\n📊 Статистика по категориям:');
  const sortedCategories = Object.entries(categoryStats)
    .sort(([,a], [,b]) => b - a);
  
  sortedCategories.forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`);
  });
  
  console.log('\n✅ Сортировка завершена успешно!');
}

// Запуск скрипта
if (require.main === module) {
  try {
    sortDictionary();
  } catch (error) {
    console.error('❌ Ошибка при сортировке:', error.message);
    process.exit(1);
  }
}

module.exports = {
  sortDictionary,
  parseCSVLine,
  normalizeWordToUpper,
  normalizeForDedup,
  csvJoin
};
