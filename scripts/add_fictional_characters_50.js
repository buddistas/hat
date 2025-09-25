/*
  Append up to 50 fictional characters to public/words.csv
  - Category: "Знаменитости"
  - Level: "обычный"
  - Preserve order as listed below
  - Skip words already present (dedupe by normalized word only)
*/

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');
const CATEGORY = 'Знаменитости';

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

const FICTIONAL_CHARACTERS = [
  'ШЕРЛОК ХОЛМС','ДЖЕЙМС БОНД','ГАРРИ ПОТТЕР','ФРОДО БЭГГИНС','ЛЮК СКАЙУОКЕР',
  'ДАРТ ВЕЙДЕР','ИНДИАНА ДЖОНС','ЛАРА КРОФТ','ТОНИ СТАРК','ПИТЕР ПАРКЕР',
  'БРЮС УЭЙН','КЛАРК КЕНТ','ДЖОКЕР','ГАННИБАЛ ЛЕКТЕР','ДЖЕК ВОРОБЕЙ',
  'АЛИСА','ДЖОН СНОУ','ДЕЙЕНЕРИС ТАРГАРИЕН','ТИРИОН ЛАННИСТЕР','ГЭНДАЛЬФ',
  'ЛЕГОЛАС','ГАРРИ КЭЛЛАХАН','РОККИ БАЛЬБОА','РЭМБО','ФОРРЕСТ ГАМП',
  'ДЖЕК ДЭНИЭЛС','ДОКТОР ХАУС','ГОМЕР СИМПСОН','БАРТ СИМПСОН','МИККИ МАУС',
  'ДОНАЛЬД ДАК','СУПЕР МАРИО','СОНИК','ПИКАЧУ','СПАНЧ БОБ',
  'ПАТРИК СТАР','СКУБИ-ДУ','ШЕГГИ РОДЖЕРС','ФРЕД ФЛИНТСТОУН','БАРНИ РАББЛ',
  'ТОМ','ДЖЕРРИ','ПИТЕР ГРИФФИН','СТЬЮИ ГРИФФИН','БАГЗ БАННИ',
  'ДАФФИ ДАК','ВУДИ ВУДПЕКЕР','ЧАРЛИ БРАУН','СНУПИ','ГАРФИЛД'
];

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }
  const existing = readExisting(CSV_PATH);
  const seen = new Set();
  const out = [];
  for (const item of FICTIONAL_CHARACTERS) {
    const n = normalizeForSet(item);
    if (!n) continue;
    if (existing.has(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(toCsvEntry(item));
    if (out.length >= 50) break;
  }
  if (!out.length) {
    console.log('No new fictional characters to append.');
    return;
  }
  const existingRaw = fs.readFileSync(CSV_PATH, 'utf8');
  const needsNewline = existingRaw.length && !/\n$/.test(existingRaw);
  fs.appendFileSync(CSV_PATH, (needsNewline ? '\n' : '') + out.join('\n') + '\n');
  console.log(`Appended ${out.length} fictional characters to public/words.csv`);
}

main();
