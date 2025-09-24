const fs = require('fs');
const path = require('path');

function normalizeWord(word) {
  return String(word)
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[.,!?:;"'()\-–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function main() {
  const csvPath = path.join(__dirname, '..', '..', 'public', 'words.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Файл public/words.csv не найден');
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const hasNewlines = raw.includes('\n');

  let entries = [];
  if (hasNewlines) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let i = 0;
    if (lines.length && /слово|word/i.test(lines[0])) {
      i = 1;
    }
    for (; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!cols.length) continue;
      const word = (cols[0] || '').trim();
      const category = (cols[1] || '').trim();
      const level = (cols[2] || '').trim().toLowerCase();
      if (!word) continue;
      entries.push({ word, category, level });
    }
  } else {
    const flat = raw.split(',').map(w => w.trim()).filter(Boolean);
    entries = flat.map(w => ({ word: w }));
  }

  // Валидации
  const errors = [];
  const normalizedSet = new Set();
  const allowedLevels = new Set(['', 'обычный', 'повышенный']);
  const allowedCategories = new Set([
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

  entries.forEach((e, idx) => {
    const norm = normalizeWord(e.word);
    if (normalizedSet.has(norm)) {
      errors.push(`Дубликат (нормализовано): "${e.word}" → "${norm}" @${idx + 1}`);
    } else {
      normalizedSet.add(norm);
    }
    if (e.level && !allowedLevels.has(e.level)) {
      errors.push(`Неизвестный уровень: "${e.level}" @${idx + 1}`);
    }
    if (e.category && !allowedCategories.has(e.category)) {
      errors.push(`Неизвестная категория: "${e.category}" @${idx + 1}`);
    }
  });

  if (errors.length) {
    console.error(`Ошибки в словаре (${errors.length}):`);
    errors.slice(0, 100).forEach(err => console.error(' - ' + err));
    if (errors.length > 100) console.error(`...и еще ${errors.length - 100}`);
    process.exit(2);
  } else {
    console.log(`OK: ${entries.length} записей, дубликатов нет, категории/уровни валидны.`);
  }
}

main();


