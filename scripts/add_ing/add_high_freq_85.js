/*
  Append 85 high-frequency Russian nouns to public/words.csv across categories:
  - "Флора и фауна"
  - "Развлечения и хобби"
  - "Вещи и предметы быта"
  - "Музыка"

  Rules:
  - Uppercase words, nominative singular
  - Level: "обычный"
  - Skip words already present in words.csv (regardless of category)
  - Avoid instrument/performer pairs (we only add instruments, skip performer roles)
  - Append in a single block
*/

const fs = require('fs');
const path = require('path');

function normalize(s) {
  return String(s).trim().toUpperCase().replace(/Ё/g, 'Е');
}

const csvPath = path.join(__dirname, '..', 'public', 'words.csv');
if (!fs.existsSync(csvPath)) {
  console.error('public/words.csv not found');
  process.exit(1);
}

const existing = fs
  .readFileSync(csvPath, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => l.split(',')[0])
  .map(normalize);

const existingSet = new Set(existing);

// Candidate pool (>140) across four categories; script will filter out existing and cap to 85
const C = {
  flora: 'Флора и фауна',
  hobby: 'Развлечения и хобби',
  household: 'Вещи и предметы быта',
  music: 'Музыка',
};

const candidates = [
  // Флора и фауна (general animals, plants, parts; many might exist and will be filtered)
  ['ЛЕВ', C.flora], ['ТИГР', C.flora], ['МЕДВЕДЬ', C.flora], ['ВОЛК', C.flora], ['ЛИСА', C.flora],
  ['ЗАЯЦ', C.flora], ['БЕЛКА', C.flora], ['ЕЖ', C.flora], ['ЛОСЬ', C.flora], ['ОЛЕНЬ', C.flora],
  ['КОШКА', C.flora], ['КОТ', C.flora], ['СОБАКА', C.flora], ['ЩЕНОК', C.flora], ['КОРОВА', C.flora],
  ['БЫК', C.flora], ['ТЕЛЕНОК', C.flora], ['СВИНЬЯ', C.flora], ['ОВЦА', C.flora], ['КОЗА', C.flora],
  ['ЛОШАДЬ', C.flora], ['ЖЕРЕБЕЦ', C.flora], ['КУРИЦА', C.flora], ['ПЕТУХ', C.flora], ['ГУСЬ', C.flora],
  ['УТКА', C.flora], ['ИНДЕЙКА', C.flora], ['ОРЕЛ', C.flora], ['СОКОЛ', C.flora], ['СОВА', C.flora],
  ['ВОРОБЕЙ', C.flora], ['ГОЛУБЬ', C.flora], ['ЖУРАВЛЬ', C.flora], ['АИСТ', C.flora], ['ЛЕБЕДЬ', C.flora],
  ['КАРП', C.flora], ['ЩУКА', C.flora], ['СОМ', C.flora], ['ОКУНЬ', C.flora], ['СЕЛЬДЬ', C.flora],
  ['ТУНЕЦ', C.flora], ['АКУЛА', C.flora], ['КИТ', C.flora], ['ДЕЛЬФИН', C.flora], ['ОСЬМИНОГ', C.flora],
  ['МЕДУЗА', C.flora], ['КРАБ', C.flora], ['РАК', C.flora], ['ПЧЕЛА', C.flora], ['ОСА', C.flora],
  ['МУРАВЕЙ', C.flora], ['КОМАР', C.flora], ['МУХА', C.flora], ['БАБОЧКА', C.flora], ['ЖУК', C.flora],
  ['ПАУК', C.flora], ['ЗМЕЯ', C.flora], ['ЯЩЕРИЦА', C.flora], ['ЧЕРЕПАХА', C.flora], ['КРОКОДИЛ', C.flora],
  ['ДЕРЕВО', C.flora], ['КУСТ', C.flora], ['ЦВЕТОК', C.flora], ['ТРАВА', C.flora], ['ЛИСТ', C.flora],
  ['СЕМЯ', C.flora], ['ПЛОД', C.flora], ['ЯГОДА', C.flora], ['МОХ', C.flora], ['ПАПОРОТНИК', C.flora],
  ['КАМЫШ', C.flora], ['РОМАШКА', C.flora], ['ТЮЛЬПАН', C.flora], ['РОЗА', C.flora], ['ПОДСОЛНУХ', C.flora],
  ['ОДУВАНЧИК', C.flora], ['КЛЕН', C.flora], ['ДУБ', C.flora], ['БЕРЕЗА', C.flora], ['СОСНА', C.flora],
  ['ЕЛЬ', C.flora], ['ПИХТА', C.flora], ['ЛИПА', C.flora], ['ТОПОЛЬ', C.flora], ['ИВА', C.flora],
  ['ЯБЛОНЯ', C.flora], ['ГРУША', C.flora], ['ВИШНЯ', C.flora], ['СЛИВА', C.flora],

  // Развлечения и хобби (skip pure sports roles; include activities not already heavy in list)
  ['ЦИРК', C.hobby], ['ТАНЕЦ', C.hobby], ['ОРИГАМИ', C.hobby], ['ЛЕПКА', C.hobby], ['ГРАФИКА', C.hobby],
  ['КАЛЛИГРАФИЯ', C.hobby], ['ОРИЕНТИРОВАНИЕ', C.hobby], ['КОЛЛЕКЦИОНИРОВАНИЕ', C.hobby], ['МОДЕЛИРОВАНИЕ', C.hobby],
  ['КОНСТРУКТОР', C.hobby], ['КОСПЛЕЙ', C.hobby], ['КРОССВОРД', C.hobby], ['СУДОКУ', C.hobby], ['ПАЗЛ', C.hobby],
  ['КЕМПИНГ', C.hobby], ['ПАЛАТКА', C.hobby], ['ПОХОД', C.hobby], ['КАРАОКЕ', C.hobby], ['КАТАНИЕ', C.hobby],
  ['КОНЬКИ', C.hobby], ['РОЛИКИ', C.hobby], ['САМОВАР', C.hobby], // borderline leisure item
  ['ПИКНИК', C.hobby], ['КВЕСТ', C.hobby], ['ВИКТОРИНА', C.hobby], ['БАРБЕКЮ', C.hobby], ['ГРИЛЬ', C.hobby],
  ['ЧТЕНИЕ', C.hobby], ['МУЛЬТФИЛЬМЫ', C.hobby], ['КОМИКСЫ', C.hobby], ['КИНО', C.hobby], ['ТЕАТР', C.hobby],

  // Вещи и предметы быта (common home items; some may exist and will be filtered)
  ['ПОДУШКА', C.household], ['ОДЕЯЛО', C.household], ['ПОЛОТЕНЦЕ', C.household], ['МЫЛО', C.household],
  ['ШАМПУНЬ', C.household], ['КРЕМ', C.household], ['ЗУБНАЯ ПАСТА', C.household], ['ТУАЛЕТНАЯ БУМАГА', C.household],
  ['ЗУБНАЯ ЩЕТКА', C.household], ['ЩЕТКА', C.household], ['МЕТЛА', C.household], ['ШВАБРА', C.household],
  ['ТАЗИК', C.household], ['ВЕДРО', C.household], ['ТЮЛЬ', C.household], ['ШТОРА', C.household],
  ['ПОКРЫВАЛО', C.household], ['ПОДОГРЕВ', C.household], ['САЛОНКА', C.household], ['СКАТЕРТЬ', C.household],
  ['ПРИБОР', C.household], ['ВИЛЫ', C.household], ['ЛОПАТА', C.household], ['МОЛОТОК', C.household],
  ['ОТВЕРТКА', C.household], ['ГВОЗДЬ', C.household], ['ВИНТ', C.household], ['БОЛТ', C.household],
  ['ШУРУП', C.household], ['КЛЮЧ', C.household], ['БУЛАВКА', C.household], ['ИГЛА', C.household],
  ['НИТКА', C.household], ['ПУГОВИЦА', C.household], ['ПЛАСТЫРЬ', C.household], ['ТЕРМОМЕТР', C.household],
  ['БАТАРЕЙКА', C.household], ['СПИЧКИ', C.household], ['ЗАЖИГАЛКА', C.household], ['ФОНАРИК', C.household],
  ['БУМАГА', C.household], ['ТЕТРАДЬ', C.household], ['РУЧКА', C.household], ['КАРАНДАШ', C.household],
  ['ЛАСТИК', C.household], ['ЛИНЕЙКА', C.household], ['КОНВЕРТ', C.household], ['ПАПКА', C.household],
  ['КЛЕЙ', C.household], ['СКОТЧ', C.household], ['НОЖНИЦЫ', C.household],

  // Музыка (only instruments/neutral terms; avoid performer roles)
  ['ПИАНИНО', C.music], ['АРФА', C.music], ['ОРГАН', C.music], ['БАЛАЛАЙКА', C.music], ['БАЯН', C.music],
  ['АККОРДЕОН', C.music], ['БАНДУРА', C.music], ['ГУСЛИ', C.music], ['ДОМРА', C.music], ['ДУДУК', C.music],
  ['ОКАРИНА', C.music],
  ['БУБЕН', C.music], ['ТАМТАМ', C.music], ['ТАРЕЛКИ', C.music], ['ТРЕУГОЛЬНИК', C.music],
  ['ВАЛТОРНА', C.music], ['ЛИТАВРЫ', C.music], ['ШОФАР', C.music], ['СИТАР', C.music], ['КАСТАНЬЕТЫ', C.music],
  ['АРМОНЬ', C.music], ['ЦИМБАЛЫ', C.music], ['КСИЛОФОН', C.music], ['МЕТАЛЛОФОН', C.music], ['МАРИМБА', C.music]
].map(([word, category]) => ({ word, category, level: 'обычный' }));

// Also avoid instrument/performer pairs: since we do not include performers here, no extra filtering needed

// Filter out existing and bad/duplicate entries; normalize Ё/Е conservatively
const seen = new Set();
const filtered = candidates.filter(({ word }) => {
  const n = normalize(word);
  if (existingSet.has(n)) return false;
  if (seen.has(n)) return false;
  seen.add(n);
  return true;
});

// Cap to 85
const toAppend = filtered.slice(0, 85);

if (toAppend.length < 85) {
  console.error(`Warning: only ${toAppend.length} unique candidates available (requested 85).`);
}

const block = toAppend.map(e => `${e.word},${e.category},${e.level}`).join('\n');
fs.appendFileSync(csvPath, (existing.length ? '\n' : '') + block + '\n');

console.log(`Appended ${toAppend.length} entries to public/words.csv`);


