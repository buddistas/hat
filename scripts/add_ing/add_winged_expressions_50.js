/*
  Append up to 50 winged expressions and phrases to public/words.csv
  - Category: "Фразеологизмы, пословицы и поговорки"
  - Level: "обычный"
  - Preserve order as listed below
  - Skip words already present (dedupe by normalized word only)
*/

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');
const CATEGORY = 'Фразеологизмы, пословицы и поговорки';

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

const WINGED_EXPRESSIONS = [
  'А СУДЬИ КТО','ЛЮБВИ ВСЕ ВОЗРАСТЫ ПОКОРНЫ','ДЕЛО МАСТЕРА БОИТСЯ','ЖЕЛЕЗНЫЙ ЗАНАВЕС',
  'МИР ТЕСЕН','МЕСТО ВСТРЕЧИ ИЗМЕНИТЬ НЕЛЬЗЯ','У ПРИРОДЫ НЕТ ПЛОХОЙ ПОГОДЫ',
  'ВРЕМЯ ЛЕЧИТ','ВСЕ ХОРОШО ЧТО ХОРОШО КОНЧАЕТСЯ','ДЕНЬГИ НЕ ПАХНУТ',
  'ДОРОГА ЛОЖКА К ОБЕДУ','ЖИВЕМ ОДИН РАЗ','ЗА ДВУМЯ ЗАЙЦАМИ ПОГОНИШЬСЯ',
  'И ВОЛКИ СЫТЫ И ОВЦЫ ЦЕЛЫ','КАК ДВЕ КАПЛИ ВОДЫ','КОНЕЦ ДЕЛУ ВЕНЕЦ',
  'КРАСОТА СПАСЕТ МИР','КУЙ ЖЕЛЕЗО ПОКА ГОРЯЧО','ЛЕС РУБЯТ ЩЕПКИ ЛЕТЯТ',
  'МАЛ ЗОЛОТНИК ДА ДОРОГ','МЕДВЕЖЬЯ УСЛУГА','МОЛЧАНИЕ ЗНАК СОГЛАСИЯ',
  'НА ВОРЕ ШАПКА ГОРИТ','НЕ В СВОЮ САНИ НЕ САДИСЬ','НЕ ВСЕ ТО ЗОЛОТО ЧТО БЛЕСТИТ',
  'НЕ ЗНАЯ БРОДУ НЕ СУЙСЯ В ВОДУ','НЕ ОТКЛАДЫВАЙ НА ЗАВТРА','НЕ ПО СЕНЬКАМ ШАПКА',
  'ОТ ДОБРА ДОБРА НЕ ИЩУТ','ПЕРВЫЙ БЛИН КОМОМ','ПО СЕКРЕТУ ВСЕМУ СВЕТУ',
  'ПОСЛЕ ДОЖДИЧКА В ЧЕТВЕРГ','ПРАВДА ГЛАЗА КОЛЕТ','ПРИШЛА БЕДА ОТВЕРНИ ВОРОТА',
  'РАБОТА НЕ ВОЛК В ЛЕС НЕ УБЕЖИТ','РЫБА ИЩЕТ ГДЕ ГЛУБЖЕ','СЕМЬ РАЗ ОТМЕРЬ ОДИН РАЗ ОТРЕЖЬ',
  'СИДЯ НА ПЕЧИ НЕ БУДЕШЬ КАЛЕНЫМ','СЛОВО НЕ ВОРОБЕЙ ВЫЛЕТИТ НЕ ПОЙМАЕШЬ','СМЕХ БЕЗ ПРИЧИНЫ ПРИЗНАК ДУРАЧИНЫ',
  'СТАРОСТЬ НЕ РАДОСТЬ','ТЕРПЕНИЕ И ТРУД ВСЕ ПЕРЕТРУТ','ТИШЕ ЕДЕШЬ ДАЛЬШЕ БУДЕШЬ',
  'У СЕМИ НЯНЕК ДИТЯ БЕЗ ГЛАЗУ','ХОРОШО ТАМ ГДЕ НАС НЕТ','ЧЕМ БОГАТЫ ТЕМ И РАДЫ',
  'ЧТО НАПИСАНО ПЕРОМ НЕ ВЫРУБИШЬ ТОПОРОМ','ЯЗЫК ДО КИЕВА ДОВЕДЕТ'
];

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }
  const existing = readExisting(CSV_PATH);
  const seen = new Set();
  const out = [];
  for (const item of WINGED_EXPRESSIONS) {
    const n = normalizeForSet(item);
    if (!n) continue;
    if (existing.has(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(toCsvEntry(item));
    if (out.length >= 50) break;
  }
  if (!out.length) {
    console.log('No new winged expressions to append.');
    return;
  }
  const existingRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const needsNewline = existingRaw.length && !/\n$/.test(existingRaw);
  fs.appendFileSync(CSV_PATH, (needsNewline ? '\n' : '') + out.join('\n') + '\n');
  console.log(`Appended ${out.length} winged expressions to public/words.csv`);
}

main();
