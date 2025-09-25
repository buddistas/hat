#!/usr/bin/env node

/**
 * Скрипт для удаления дубликатов в словаре
 * 
 * Правила определения дубликатов:
 * 1. Более короткий вариант остается
 * 2. Удаляется вариант с повышенной сложностью
 * 3. Учитывается перестановка слов в составных терминах
 * 4. Морфологическая нормализация (ё→е, пунктуация, регистр)
 * 
 * Выводит в терминал пары найденных дубликатов
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');

/**
 * Нормализация слова для сравнения
 * - Приведение к нижнему регистру
 * - Замена ё на е
 * - Удаление пунктуации
 * - Сжатие пробелов
 * - Базовая морфологическая нормализация
 */
function normalizeWord(word) {
  if (!word) return '';
  let normalized = String(word)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?:;"'()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Консервативная морфологическая нормализация
  // Удаляем только очевидные окончания множественного числа
  if (normalized.length > 4) { // Не нормализуем короткие слова
    // Только множественное число
    normalized = normalized
      .replace(/([ыи])$/, '') // рецепт-ы, рецепт-и -> рецепт
      .replace(/([ая])$/, '') // рецепт-а, рецепт-я -> рецепт
      .replace(/([ео])$/, '') // носок-е, носок-о -> носок
      .replace(/([ую])$/, '') // носок-у, носок-ю -> носок
      .replace(/([омем])$/, '') // носок-ом, носок-ем -> носок
      .replace(/([ахях])$/, '') // носок-ах, носок-ях -> носок
      .replace(/([амиями])$/, '') // носок-ами, носок-ями -> носок
      .replace(/([овев])$/, '') // носок-ов, носок-ев -> носок
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
 * Основная функция удаления дубликатов
 */
function removeDuplicates() {
  console.log('Запуск скрипта удаления дубликатов...');
  console.log(`Путь к файлу: ${CSV_PATH}`);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error('Файл public/words.csv не найден');
    process.exit(1);
  }

  console.log('Чтение словаря...');
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  
  // Определяем наличие заголовка
  const hasHeader = lines.length > 0 && /\b(слово|word)\b/i.test(lines[0]);
  const header = hasHeader ? lines[0] : null;
  const startIndex = hasHeader ? 1 : 0;

  console.log(`Обработка ${lines.length - startIndex} записей...`);
  console.log(`Заголовок: ${hasHeader ? 'найден' : 'не найден'}`);

  // Группировка по нормализованным фразам
  const phraseGroups = new Map();
  const duplicates = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    const word = cols[0] || '';
    const category = cols[1] || '';
    const difficulty = cols[2] || '';
    
    if (!word) continue;

    const normalizedPhrase = normalizePhrase(word);
    
    if (!phraseGroups.has(normalizedPhrase)) {
      phraseGroups.set(normalizedPhrase, []);
    }
    
    phraseGroups.get(normalizedPhrase).push({
      originalLine: line,
      word,
      category,
      difficulty,
      lineNumber: i + 1
    });
  }

  // Отладочная информация - показываем несколько примеров нормализации
  console.log('\nПримеры нормализации:');
  let exampleCount = 0;
  let duplicateGroups = 0;
  
  for (const [normalized, entries] of phraseGroups) {
    if (entries.length > 1) {
      duplicateGroups++;
      if (exampleCount < 5) {
        console.log(`"${normalized}" -> ${entries.map(e => `"${e.word}"`).join(', ')}`);
        exampleCount++;
      }
    }
  }
  
  if (duplicateGroups === 0) {
    console.log('Дубликаты не найдены!');
  } else {
    console.log(`\nНайдено ${duplicateGroups} групп дубликатов.`);
  }

  // Обработка групп и поиск дубликатов
  const uniqueEntries = [];
  
  for (const [normalizedPhrase, entries] of phraseGroups) {
    if (entries.length === 1) {
      // Уникальная запись
      uniqueEntries.push(entries[0]);
    } else {
      // Найдены дубликаты
      console.log(`\nНайдены дубликаты для "${normalizedPhrase}":`);
      
      // Сортируем по правилам приоритета:
      // 1. Сначала по длине слова (короче лучше)
      // 2. Затем по сложности (обычный лучше повышенного)
      entries.sort((a, b) => {
        const lengthDiff = a.word.length - b.word.length;
        if (lengthDiff !== 0) return lengthDiff;
        
        // Если длины равны, приоритет у "обычный" перед "повышенный"
        if (a.difficulty === 'обычный' && b.difficulty === 'повышенный') return -1;
        if (a.difficulty === 'повышенный' && b.difficulty === 'обычный') return 1;
        
        return 0;
      });

      // Оставляем первый (лучший) вариант
      const keep = entries[0];
      uniqueEntries.push(keep);
      
      // Остальные считаем дубликатами
      for (let i = 1; i < entries.length; i++) {
        const duplicate = entries[i];
        duplicates.push(duplicate);
        console.log(`  УДАЛЯЕМ: "${duplicate.word}" (строка ${duplicate.lineNumber}, ${duplicate.difficulty})`);
        console.log(`  ОСТАВЛЯЕМ: "${keep.word}" (строка ${keep.lineNumber}, ${keep.difficulty})`);
      }
    }
  }

  // Создание backup
  const backupName = `words_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  const backupPath = path.join(__dirname, '..', 'public', backupName);
  fs.writeFileSync(backupPath, raw, 'utf8');
  console.log(`\nСоздан backup: ${path.relative(process.cwd(), backupPath)}`);

  // Запись результата
  const outputLines = [];
  if (hasHeader) outputLines.push(header);
  
  for (const entry of uniqueEntries) {
    const cols = parseCSVLine(entry.originalLine);
    outputLines.push(csvJoin(cols));
  }

  fs.writeFileSync(CSV_PATH, outputLines.join('\n') + '\n', 'utf8');

  // Статистика
  const originalCount = lines.length - startIndex;
  const finalCount = uniqueEntries.length;
  const removedCount = duplicates.length;

  console.log(`\n=== РЕЗУЛЬТАТ ===`);
  console.log(`Исходное количество записей: ${originalCount}`);
  console.log(`Удалено дубликатов: ${removedCount}`);
  console.log(`Осталось уникальных записей: ${finalCount}`);
  console.log(`Файл обновлен: ${path.relative(process.cwd(), CSV_PATH)}`);
  
  if (removedCount > 0) {
    console.log(`\nВсего найдено групп дубликатов: ${phraseGroups.size - uniqueEntries.length + removedCount}`);
  } else {
    console.log(`\nДубликаты не найдены!`);
  }
}

// Запуск скрипта
if (require.main === module) {
  removeDuplicates();
}

module.exports = { removeDuplicates, normalizeWord, normalizePhrase };
