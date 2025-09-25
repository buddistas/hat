// Remove duplicates by normalized word, preserve first occurrence and order; fix level typos
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'words.csv');

function collapseSpaces(str) {
  return String(str).replace(/\s+/g, ' ').trim();
}

function normalizeWordForSet(word) {
  if (!word) return '';
  return collapseSpaces(word)
    .replace(/Ё/g, 'Е')
    .replace(/ё/g, 'е')
    .replace(/["!?,.:;()\[\]{}]/g, '')
    .toUpperCase();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result.map(x => x.trim());
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  const hasHeader = lines.length > 0 && /(слово|word)/i.test(lines[0]);
  const header = hasHeader ? lines[0] : null;
  const start = hasHeader ? 1 : 0;

  const seen = new Set();
  const out = [];
  if (header) out.push(header);

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const word = cols[0] || '';
    if (!word) continue;
    const key = normalizeWordForSet(word);
    if (seen.has(key)) continue;
    seen.add(key);

    // fix level typos (e.g., "обычныйй" -> "обычный")
    if (cols.length >= 3) {
      let level = collapseSpaces(cols[2] || '');
      if (/^обычныйй$/i.test(level)) level = 'обычный';
      cols[2] = level;
    }

    // reconstruct line preserving commas/quotes where possible
    const safe = cols.map((c) => {
      if (c == null) return '';
      const needsQuotes = /[,\"]/.test(c);
      if (needsQuotes) return '"' + c.replace(/\"/g, '""') + '"';
      return c;
    }).join(',');

    out.push(safe);
  }

  const bakName = `words_backup_before_dedupe_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  fs.writeFileSync(path.join(path.dirname(CSV_PATH), bakName), raw);
  fs.writeFileSync(CSV_PATH, out.join('\n') + '\n');
  console.log(`Deduped. Kept ${out.length - (header ? 1 : 0)} unique rows.`);
}

main();
