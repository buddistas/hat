/*
  Normalizes and sorts public/words.csv
  - Backup to public/words_backup_<ISO>.csv
  - Preserve header if present (first line containing 'слово' or 'word')
  - CSV format: слово,категория,уровень
  - Normalize ONLY word to UPPERCASE; normalize spaces, hyphens (– — − → -), apostrophes (’ ` ´ → ')
  - Allow hyphens and apostrophes; keep other punctuation as-is in word
  - Deduplicate exact triples (word+category+level) after normalization
  - Sort by category (ru collation, sensitivity=base), then by word (ru collation, base)
*/

const fs = require('fs');
const path = require('path');

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

function normalizeHyphensAndApostrophes(str) {
  if (!str) return str;
  return str
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-') // hyphens/dashes → -
    .replace(/[\u2018\u2019\u02BC\u2032\u00B4\u0060]/g, "'"); // apostrophes/prime/grave/acute → '
}

function collapseSpaces(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function normalizeWordToUpper(str) {
  let s = String(str || '');
  s = normalizeHyphensAndApostrophes(s);
  s = collapseSpaces(s);
  // Uppercase using default locale; Node uses ICU; this handles Cyrillic
  s = s.toUpperCase();
  return s;
}

function main() {
  const csvPath = path.join(__dirname, '..', 'public', 'words.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0) return;

  const headerPresent = lines.length > 0 && /\b(слово|word)\b/i.test(lines[0]);
  const startIndex = headerPresent ? 1 : 0;
  const headerLine = headerPresent ? lines[0] : null;

  const records = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;
    const cols = parseCSVLine(rawLine.trim());
    if (cols.length === 0) continue;
    const word = collapseSpaces(cols[0] || '');
    const category = collapseSpaces(cols[1] || '');
    const level = collapseSpaces(cols[2] || '');
    if (!word) continue; // skip empty word rows
    records.push({ word, category, level });
  }

  // Normalize
  for (const r of records) {
    r.word = normalizeWordToUpper(r.word);
    r.category = normalizeHyphensAndApostrophes(collapseSpaces(r.category));
    r.level = normalizeHyphensAndApostrophes(collapseSpaces(r.level.toLowerCase())) || '';
  }

  // Dedupe by normalized word only (ignore category and level)
  const seenWords = new Set();
  const deduped = [];
  for (const r of records) {
    const key = r.word; // already normalized uppercase with collapsed spaces and normalized hyphens/apostrophes
    if (!seenWords.has(key)) {
      seenWords.add(key);
      deduped.push(r);
    }
  }

  // Sort: by category, then by word using ru collator (base)
  const collator = new Intl.Collator('ru', { sensitivity: 'base' });
  deduped.sort((a, b) => {
    const c = collator.compare(a.category || '', b.category || '');
    if (c !== 0) return c;
    return collator.compare(a.word, b.word);
  });

  // Backup
  const backupName = `words_backup_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T')}.csv`;
  const backupPath = path.join(__dirname, '..', 'public', backupName);
  fs.writeFileSync(backupPath, raw, 'utf8');
  console.log(`Backup created: ${path.relative(process.cwd(), backupPath)}`);

  // Write back (preserve header if existed)
  const outLines = [];
  if (headerPresent) outLines.push(headerLine.trim());
  for (const r of deduped) {
    outLines.push(csvJoin([r.word, r.category, r.level]));
  }
  fs.writeFileSync(csvPath, outLines.join('\n') + '\n', 'utf8');
  console.log(`Normalized ${deduped.length} rows → ${path.relative(process.cwd(), csvPath)}`);
}

if (require.main === module) {
  main();
}

module.exports = { parseCSVLine, normalizeWordToUpper };


