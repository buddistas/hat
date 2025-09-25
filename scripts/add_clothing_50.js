/*
  Append up to 50 clothing-related words to public/words.csv
  - Category: "Вещи и предметы быта"
  - Level: "обычный"
  - Preserve order as listed below
  - Skip words already present (dedupe by normalized word only)
*/

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');
const CATEGORY = 'Вещи и предметы быта';

function collapseSpaces(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

function normalizeForSet(str) {
  if (!str) return '';
  const s = collapseSpaces(String(str))
    .replace(/Ё/g, 'Е')
    .replace(/ё/g, 'е')
    .replace(/["!?,.:;()\[\]{}]/g, '');
  return s.toUpperCase();
}

function readExisting(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const startIndex = lines.length && /(слово|word)/i.test(lines[0]) ? 1 : 0;
  const set = new Set();
  for (let i = startIndex; i < lines.length; i++) {
    const word = (lines[i].split(',')[0] || '').trim();
    if (!word) continue;
    set.add(normalizeForSet(word));
  }
  return set;
}

function toCsvEntry(word) {
  const w = word.includes(',') ? `"${word}"` : word;
  const c = CATEGORY.includes(',') ? `"${CATEGORY}"` : CATEGORY;
  return `${w},${c},обычный`;
}

const CLOTHING = [
  'ПАЛЬТО','КУРТКА','ПЛАЩ','ПИДЖАК','ЖАКЕТ','СВИТЕР','ДЖЕМПЕР','КАРДИГАН','БЛУЗКА','РУБАШКА',
  'ФУТБОЛКА','МАЙКА','ТОП','ПЛАТЬЕ','САРАФАН','ЮБКА','БРЮКИ','ДЖИНСЫ','ЛЕГГИНСЫ','ШОРТЫ',
  'КОМБИНЕЗОН','КОСТЮМ','ЖИЛЕТ','ПОНЧО','ПУХОВИК','АНОРАК','ПАРКА','ДАФЛКОТ','ПЫЛЬНИК',
  'БЛЕЙЗЕР','БОЛЕРО','ПУЛОВЕР','ВОДОЛАЗКА','КИМОНО','ТУНИКА','ХУДИ','СВИТШОТ','ТОЛСТОВКА','БОДИ',
  'БЮСТГАЛТЕР','ТРУСЫ','ПИЖАМА','ХАЛАТ','КАЛЬСОНЫ','КОЛГОТКИ','ЧУЛКИ','НОСКИ','ПЕРЧАТКИ','ШАРФ','ШАПКА'
];

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }
  const existing = readExisting(CSV_PATH);
  const seen = new Set();
  const out = [];
  for (const item of CLOTHING) {
    const n = normalizeForSet(item);
    if (!n) continue;
    if (existing.has(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(toCsvEntry(item));
    if (out.length >= 50) break;
  }
  if (!out.length) {
    console.log('No new clothing words to append.');
    return;
  }
  const existingRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const needsNewline = existingRaw.length && !/\n$/.test(existingRaw);
  fs.appendFileSync(CSV_PATH, (needsNewline ? '\n' : '') + out.join('\n') + '\n');
  console.log(`Appended ${out.length} clothing words to public/words.csv`);
}

main();


