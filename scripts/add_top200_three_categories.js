/*
  Append up to 200 unique words for each of the three categories to public/words.csv:
  - "Природные явления"
  - "Музыка"
  - "Вещи и предметы быта"

  Rules:
  - Words are provided in external data files under data/*.txt (one per line, uppercase preferred)
  - Normalize for dedupe: trim, collapse spaces, Ё→Е, remove punctuation except hyphen and apostrophe,
    compare case-insensitively by uppercase with collapsed spaces
  - Skip words already present in words.csv (regardless of category/level)
  - Skip duplicates within the same run
  - Category column set accordingly; Level column set to "обычный"
  - Append in a single block per category in order: nature, music, household
*/

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');

const CATEGORY = {
  nature: 'Природные явления',
  music: 'Музыка',
  household: 'Вещи и предметы быта',
};

function collapseSpaces(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

function normalizeForSet(str) {
  if (!str) return '';
  const s = collapseSpaces(String(str))
    .replace(/Ё/g, 'Е')
    .replace(/ё/g, 'е')
    .replace(/[\u2019\u2018]/g, "'");
  // remove punctuation except hyphen and apostrophe
  const withoutPunct = s.replace(/["!?,.:;()\[\]{}]/g, '');
  return withoutPunct.toUpperCase();
}

function readExistingWords(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const startIndex = lines.length && /(слово|word)/i.test(lines[0]) ? 1 : 0;
  const existing = [];
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const word = line.split(',')[0] || '';
    if (!word) continue;
    existing.push(normalizeForSet(word));
  }
  return new Set(existing);
}

function readPool(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map(x => collapseSpaces(x))
    .filter(Boolean);
}

function toCsvEntry(word, category, level = 'обычный') {
  // escape commas within word if any (unlikely)
  const safeWord = word.includes(',') ? `"${word}"` : word;
  const safeCategory = category.includes(',') ? `"${category}"` : category;
  const safeLevel = level.includes(',') ? `"${level}"` : level;
  return `${safeWord},${safeCategory},${safeLevel}`;
}

function appendCategory(csvPath, categoryName, poolWords, existingSet, targetCount = 200) {
  const seen = new Set();
  const outEntries = [];
  for (const w of poolWords) {
    const n = normalizeForSet(w);
    if (!n) continue;
    if (existingSet.has(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    outEntries.push(toCsvEntry(w, categoryName));
    if (outEntries.length >= targetCount) break;
  }
  if (outEntries.length === 0) return '';
  // update existing set so next categories also dedupe across newly added words in this run
  for (const w of seen) existingSet.add(w);
  return outEntries.join('\n') + '\n';
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }

  const dataDir = path.join(__dirname, '..', 'data');
  const naturePath = path.join(dataDir, 'nature_phenomena_ru.txt');
  const musicPath = path.join(dataDir, 'music_ru.txt');
  const householdPath = path.join(dataDir, 'household_items_ru.txt');

  for (const p of [naturePath, musicPath, householdPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Data file missing: ${p}`);
      process.exit(1);
    }
  }

  const existing = readExistingWords(CSV_PATH);
  const poolNature = readPool(naturePath);
  const poolMusic = readPool(musicPath);
  const poolHousehold = readPool(householdPath);

  const blocks = [];
  const natureBlock = appendCategory(CSV_PATH, CATEGORY.nature, poolNature, existing, 200);
  if (natureBlock) blocks.push(natureBlock);
  const musicBlock = appendCategory(CSV_PATH, CATEGORY.music, poolMusic, existing, 200);
  if (musicBlock) blocks.push(musicBlock);
  const householdBlock = appendCategory(CSV_PATH, CATEGORY.household, poolHousehold, existing, 200);
  if (householdBlock) blocks.push(householdBlock);

  if (!blocks.length) {
    console.log('No new entries to append.');
    return;
  }

  const existingRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const needsNewline = existingRaw.length && !/\n$/.test(existingRaw);
  const block = blocks.join('');
  fs.appendFileSync(CSV_PATH, (needsNewline ? '\n' : '') + block);
  console.log(`Appended blocks: nature=${natureBlock ? 'yes' : 'no'}, music=${musicBlock ? 'yes' : 'no'}, household=${householdBlock ? 'yes' : 'no'}`);
}

main();


