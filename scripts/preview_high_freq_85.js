// Preview the exact 85 entries that scripts/add_high_freq_85.js would append
const fs = require('fs');
const path = require('path');

function normalize(s) {
  return String(s).trim().toUpperCase().replace(/Ё/g, 'Е');
}

const csvPath = path.join(__dirname, '..', 'public', 'words.csv');
const existing = fs
  .readFileSync(csvPath, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean)
  .map(l => l.split(',')[0])
  .map(normalize);
const existingSet = new Set(existing);

const C = {
  flora: 'Флора и фауна',
  hobby: 'Развлечения и хобби',
  household: 'Вещи и предметы быта',
  music: 'Музыка',
};

const candidates = [
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

  ['ЦИРК', C.hobby], ['ТАНЕЦ', C.hobby], ['ОРИГАМИ', C.hobby], ['ЛЕПКА', C.hobby], ['ГРАФИКА', C.hobby],
  ['КАЛЛИГРАФИЯ', C.hobby], ['ОРИЕНТИРОВАНИЕ', C.hobby], ['КОЛЛЕКЦИОНИРОВАНИЕ', C.hobby], ['МОДЕЛИРОВАНИЕ', C.hobby],
  ['КОНСТРУКТОР', C.hobby], ['КОСПЛЕЙ', C.hobby], ['КРОССВОРД', C.hobby], ['СУДОКУ', C.hobby], ['ПАЗЛ', C.hobby],
  ['КЕМПИНГ', C.hobby], ['ПАЛАТКА', C.hobby], ['ПОХОД', C.hobby], ['КАРАОКЕ', C.hobby], ['КАТАНИЕ', C.hobby],
  ['КОНЬКИ', C.hobby], ['РОЛИКИ', C.hobby], ['ПИКНИК', C.hobby], ['КВЕСТ', C.hobby], ['ВИКТОРИНА', C.hobby],
  ['БАРБЕКЮ', C.hobby], ['ГРИЛЬ', C.hobby], ['ЧТЕНИЕ', C.hobby], ['МУЛЬТФИЛЬМЫ', C.hobby], ['КОМИКСЫ', C.hobby],
  ['КИНО', C.hobby], ['ТЕАТР', C.hobby],

  ['ПОДУШКА', C.household], ['ОДЕЯЛО', C.household], ['ПОЛОТЕНЦЕ', C.household], ['МЫЛО', C.household],
  ['ШАМПУНЬ', C.household], ['КРЕМ', C.household], ['ЗУБНАЯ ПАСТА', C.household], ['ТУАЛЕТНАЯ БУМАГА', C.household],
  ['ЗУБНАЯ ЩЕТКА', C.household], ['ЩЕТКА', C.household], ['МЕТЛА', C.household], ['ШВАБРА', C.household],
  ['ТАЗИК', C.household], ['ВЕДРО', C.household], ['ТЮЛЬ', C.household], ['ШТОРА', C.household],
  ['ПОКРЫВАЛО', C.household], ['СКАТЕРТЬ', C.household], ['СТАКАН', C.household], ['КРУЖКА', C.household],
  ['ТАРЕЛКА', C.household], ['ЛОЖКА', C.household], ['ВИЛКА', C.household], ['НОЖ', C.household],
  ['ЛОПАТА', C.household], ['МОЛОТОК', C.household], ['ОТВЕРТКА', C.household], ['ГВОЗДЬ', C.household],
  ['ВИНТ', C.household], ['БОЛТ', C.household], ['ШУРУП', C.household], ['КЛЮЧ', C.household],
  ['БУЛАВКА', C.household], ['ИГЛА', C.household], ['НИТКА', C.household], ['ПУГОВИЦА', C.household],
  ['ПЛАСТЫРЬ', C.household], ['БАТАРЕЙКА', C.household], ['СПИЧКИ', C.household], ['ЗАЖИГАЛКА', C.household],
  ['ФОНАРИК', C.household], ['БУМАГА', C.household], ['ТЕТРАДЬ', C.household], ['РУЧКА', C.household],
  ['КАРАНДАШ', C.household], ['ЛАСТИК', C.household], ['ЛИНЕЙКА', C.household], ['КОНВЕРТ', C.household],
  ['ПАПКА', C.household], ['КЛЕЙ', C.household], ['СКОТЧ', C.household], ['НОЖНИЦЫ', C.household],

  ['ПИАНИНО', C.music], ['АРФА', C.music], ['ОРГАН', C.music], ['БАЛАЛАЙКА', C.music], ['БАЯН', C.music],
  ['АККОРДЕОН', C.music], ['БАНДУРА', C.music], ['ГУСЛИ', C.music], ['ДОМРА', C.music], ['ДУДУК', C.music],
  ['ОКАРИНА', C.music], ['БУБЕН', C.music], ['ТАМТАМ', C.music], ['ТАРЕЛКИ', C.music], ['ТРЕУГОЛЬНИК', C.music],
  ['ВАЛТОРНА', C.music], ['ЛИТАВРЫ', C.music], ['ШОФАР', C.music], ['СИТАР', C.music], ['КАСТАНЬЕТЫ', C.music],
  ['ЦИМБАЛЫ', C.music], ['КСИЛОФОН', C.music], ['МЕТАЛЛОФОН', C.music], ['МАРИМБА', C.music],
].map(([word, category]) => ({ word, category, level: 'обычный' }));

const seen = new Set();
const filtered = candidates.filter(({ word }) => {
  const n = normalize(word);
  if (existingSet.has(n)) return false;
  if (seen.has(n)) return false;
  seen.add(n);
  return true;
});

const toAppend = filtered.slice(0, 85);
toAppend.forEach(e => console.log(`${e.word},${e.category},${e.level}`));


