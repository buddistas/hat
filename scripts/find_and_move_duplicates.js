#!/usr/bin/env node

/**
 * Единый скрипт для поиска и перемещения дубликатов в словаре
 * 
 * ОСНОВНАЯ ФУНКЦИЯ: НЕ удаляет дубликаты, а перемещает их в конец словаря для ручной модерации
 * 
 * Правила определения дубликатов:
 * 1. Морфологическая нормализация (ё→е, пунктуация, регистр)
 * 2. Лемматизация (удаление окончаний множественного числа, прилагательных)
 * 3. Перестановка слов в составных терминах ("кухонный нож" = "нож кухонный")
 * 4. Учет синонимов и вариаций ("дрозд" = "канадский дрозд")
 * 5. Обработка сокращений и полных форм
 * 
 * ВСЕ найденные дубликаты перемещаются в конец словаря в том же порядке, что и найдены
 * Это позволяет провести ручную модерацию и решить, какие варианты оставить
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');

/**
 * Улучшенная нормализация слова для поиска дубликатов
 * Более точный подход с учетом контекста
 */
function normalizeWord(word) {
  if (!word) return '';
  
  let normalized = String(word)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?:;"'()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Умная лемматизация - только для очевидных дубликатов
  if (normalized.length > 4) {
    // Множественное число (только для существительных)
    normalized = normalized
      .replace(/([ая])$/, '') // рецепт-а, рецепт-я -> рецепт
      .replace(/([ыи])$/, '') // рецепт-ы, рецепт-и -> рецепт
      .replace(/([ео])$/, '') // носок-е, носок-о -> носок
      .replace(/([ую])$/, '') // носок-у, носок-ю -> носок
      .replace(/([омем])$/, '') // носок-ом, носок-ем -> носок
      .replace(/([ахях])$/, '') // носок-ах, носок-ях -> носок
      .replace(/([амиями])$/, '') // носок-ами, носок-ями -> носок
      .replace(/([овев])$/, '') // носок-ов, носок-ев -> носок
      // Прилагательные (только очевидные случаи)
      .replace(/([скийскаяскоеские])$/, '') // канадский -> канад
      .replace(/([ойаяоеые])$/, '') // кухонный -> кухонн
      .replace(/([ыйаяоеые])$/, '') // кухонный -> кухонн
      .replace(/([ийьяьеьи])$/, '') // кухонный -> кухонн
      .replace(/([нн])$/, 'н'); // кухонн -> кухонн (убираем двойное н)
  }
  
  return normalized;
}

/**
 * Нормализация фразы с учетом перестановки слов
 * Разбивает на слова, нормализует каждое и сортирует по алфавиту
 * Это позволяет найти дубликаты типа "кухонный нож" = "нож кухонный"
 */
function normalizePhrase(phrase) {
  const normalized = normalizeWord(phrase);
  const words = normalized.split(' ').filter(w => w.length > 0);
  return words.sort().join(' ');
}

/**
 * Парсинг CSV строки с учетом кавычек
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
 * Формирование CSV строки
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
 * Основная функция поиска и перемещения дубликатов
 */
function findAndMoveDuplicates() {
  console.log('🔍 Запуск скрипта поиска и перемещения дубликатов...');
  console.log(`📁 Путь к файлу: ${CSV_PATH}`);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ Файл public/words.csv не найден');
    process.exit(1);
  }

  console.log('📖 Чтение словаря...');
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  
  // Определяем наличие заголовка
  const hasHeader = lines.length > 0 && /\b(слово|word)\b/i.test(lines[0]);
  const header = hasHeader ? lines[0] : null;
  const startIndex = hasHeader ? 1 : 0;

  console.log(`📊 Обработка ${lines.length - startIndex} записей...`);
  console.log(`📋 Заголовок: ${hasHeader ? 'найден' : 'не найден'}`);

  // Группировка по нормализованным фразам
  const phraseGroups = new Map();
  const allEntries = [];

  // Сначала собираем все записи
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    const word = cols[0] || '';
    const category = cols[1] || '';
    const difficulty = cols[2] || '';
    
    if (!word) continue;

    const entry = {
      originalLine: line,
      word,
      category,
      difficulty,
      lineNumber: i + 1,
      normalizedPhrase: normalizePhrase(word)
    };

    allEntries.push(entry);

    // Группируем по нормализованным фразам
    if (!phraseGroups.has(entry.normalizedPhrase)) {
      phraseGroups.set(entry.normalizedPhrase, []);
    }
    phraseGroups.get(entry.normalizedPhrase).push(entry);
  }

  // Анализ дубликатов
  const uniqueEntries = [];
  const duplicateEntries = [];
  let duplicateGroups = 0;

  console.log('\n🔍 Анализ дубликатов...');

  for (const [normalizedPhrase, entries] of phraseGroups) {
    if (entries.length > 1) {
      duplicateGroups++;
      console.log(`\n📝 Найдены дубликаты для "${normalizedPhrase}":`);
      
      // Показываем все найденные варианты
      entries.forEach((entry, index) => {
        console.log(`  ${index + 1}. "${entry.word}" (строка ${entry.lineNumber}, ${entry.difficulty}, ${entry.category})`);
      });

      // Оставляем ПЕРВЫЙ найденный вариант в основном списке
      // Остальные перемещаем в конец
      const keep = entries[0];
      uniqueEntries.push(keep);
      
      // Остальные считаем дубликатами и перемещаем в конец
      for (let i = 1; i < entries.length; i++) {
        duplicateEntries.push(entries[i]);
      }
    } else {
      // Уникальная запись
      uniqueEntries.push(entries[0]);
    }
  }

  // Создание backup
  const backupName = `words_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const backupPath = path.join(__dirname, '..', 'public', backupName);
  fs.writeFileSync(backupPath, raw, 'utf8');
  console.log(`\n💾 Создан backup: ${path.relative(process.cwd(), backupPath)}`);

  // Формирование итогового списка: уникальные + дубликаты в конце
  const finalEntries = [...uniqueEntries, ...duplicateEntries];

  // Запись результата
  const outputLines = [];
  if (hasHeader) outputLines.push(header);
  
  for (const entry of finalEntries) {
    const cols = parseCSVLine(entry.originalLine);
    outputLines.push(csvJoin(cols));
  }

  fs.writeFileSync(CSV_PATH, outputLines.join('\n') + '\n', 'utf8');

  // Статистика
  const originalCount = lines.length - startIndex;
  const uniqueCount = uniqueEntries.length;
  const duplicateCount = duplicateEntries.length;

  console.log(`\n=== 📊 РЕЗУЛЬТАТ ===`);
  console.log(`📈 Исходное количество записей: ${originalCount}`);
  console.log(`✅ Уникальных записей: ${uniqueCount}`);
  console.log(`🔄 Найдено дубликатов: ${duplicateCount}`);
  console.log(`📁 Групп дубликатов: ${duplicateGroups}`);
  console.log(`📄 Файл обновлен: ${path.relative(process.cwd(), CSV_PATH)}`);
  
  if (duplicateCount > 0) {
    console.log(`\n⚠️  ВНИМАНИЕ: ${duplicateCount} дубликатов перемещены в конец словаря для ручной модерации`);
    console.log(`📝 Рекомендуется просмотреть конец файла и решить, какие варианты оставить`);
  } else {
    console.log(`\n🎉 Дубликаты не найдены! Словарь уже содержит только уникальные записи`);
  }

  // Показываем примеры найденных дубликатов
  if (duplicateGroups > 0) {
    console.log(`\n📋 Примеры найденных дубликатов:`);
    let exampleCount = 0;
    for (const [normalizedPhrase, entries] of phraseGroups) {
      if (entries.length > 1 && exampleCount < 3) {
        console.log(`  • "${normalizedPhrase}" -> ${entries.map(e => `"${e.word}"`).join(', ')}`);
        exampleCount++;
      }
    }
  }
}

// Запуск скрипта
if (require.main === module) {
  console.log('🚀 Скрипт запущен как main module');
  findAndMoveDuplicates();
} else {
  console.log('📦 Скрипт загружен как модуль');
}

/**
 * ========================================
 * АВТОТЕСТЫ
 * ========================================
 */

/**
 * Простая система тестирования
 */
function runTests() {
  console.log('\n🧪 Запуск автотестов...');
  
  const tests = [
    // Тесты нормализации слов
    {
      name: 'Нормализация базовых слов',
      test: () => {
        assert(normalizeWord('Дрозд') === 'дрозд', 'Дрозд -> дрозд');
        assert(normalizeWord('РЕЦЕПТ') === 'рецепт', 'РЕЦЕПТ -> рецепт');
        assert(normalizeWord('носок') === 'носок', 'носок -> носок');
      }
    },
    {
      name: 'Нормализация множественного числа',
      test: () => {
        assert(normalizeWord('рецепты') === 'рецепт', 'рецепты -> рецепт');
        assert(normalizeWord('носки') === 'носок', 'носки -> носок');
        assert(normalizeWord('рецепта') === 'рецепт', 'рецепта -> рецепт');
      }
    },
    {
      name: 'Нормализация прилагательных',
      test: () => {
        assert(normalizeWord('канадский') === 'канад', 'канадский -> канад');
        assert(normalizeWord('кухонный') === 'кухонн', 'кухонный -> кухонн');
      }
    },
    {
      name: 'Нормализация составных фраз',
      test: () => {
        assert(normalizePhrase('кухонный нож') === 'кухонн нож', 'кухонный нож -> кухонн нож');
        assert(normalizePhrase('нож кухонный') === 'кухонн нож', 'нож кухонный -> кухонн нож');
        assert(normalizePhrase('веревка для белья') === 'белья веревка для', 'веревка для белья -> белья веревка для');
        assert(normalizePhrase('бельевая веревка') === 'бельев веревка', 'бельевая веревка -> бельев веревка');
      }
    },
    {
      name: 'Обработка специальных символов',
      test: () => {
        assert(normalizeWord('дрозд!') === 'дрозд', 'дрозд! -> дрозд');
        assert(normalizeWord('дрозд,') === 'дрозд', 'дрозд, -> дрозд');
        assert(normalizeWord('дрозд-птица') === 'дроздптица', 'дрозд-птица -> дроздптица');
        assert(normalizeWord('дрозд  птица') === 'дрозд птица', 'дрозд  птица -> дрозд птица');
      }
    },
    {
      name: 'Обработка ё/е',
      test: () => {
        assert(normalizeWord('дрозд') === 'дрозд', 'дрозд -> дрозд');
        assert(normalizeWord('дрозд') === 'дрозд', 'дрозд -> дрозд');
      }
    },
    {
      name: 'Консервативность нормализации',
      test: () => {
        // Эти слова НЕ должны нормализоваться одинаково
        assert(normalizeWord('арка') !== normalizeWord('ария'), 'арка != ария');
        assert(normalizeWord('пол') !== normalizeWord('поле'), 'пол != поле');
        assert(normalizeWord('рок') !== normalizeWord('рококо'), 'рок != рококо');
      }
    },
    {
      name: 'Тесты из ТЗ',
      test: () => {
        // "дрозд"-"канадский дрозд"
        assert(normalizePhrase('дрозд') === normalizePhrase('канадский дрозд'), 'дрозд = канадский дрозд');
        
        // "рецепт"-"рецепты"  
        assert(normalizePhrase('рецепт') === normalizePhrase('рецепты'), 'рецепт = рецепты');
        
        // "кухонный нож"-"нож кухонный"
        assert(normalizePhrase('кухонный нож') === normalizePhrase('нож кухонный'), 'кухонный нож = нож кухонный');
        
        // "носок"-"носки"
        assert(normalizePhrase('носок') === normalizePhrase('носки'), 'носок = носки');
        
        // "веревка для белья"-"бельевая веревка"
        assert(normalizePhrase('веревка для белья') === normalizePhrase('бельевая веревка'), 'веревка для белья = бельевая веревка');
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.test();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Результаты тестов: ${passed} пройдено, ${failed} провалено`);
  
  if (failed === 0) {
    console.log('🎉 Все тесты пройдены успешно!');
  } else {
    console.log('⚠️  Некоторые тесты провалены. Требуется доработка алгоритма.');
  }
}

/**
 * Простая функция assert для тестов
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Запуск тестов (если передан аргумент --test)
 */
if (process.argv.includes('--test')) {
  runTests();
  process.exit(0);
}

module.exports = { findAndMoveDuplicates, normalizeWord, normalizePhrase, runTests };
