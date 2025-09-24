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

function main() {
  const csvPath = path.join(__dirname, '..', 'public', 'words.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const target = new Set(['Фильмы и сериалы', 'Книги и литература']);
  const acc = {};
  for (const t of target) acc[t] = { total: 0, hi: 0, lo: 0 };

  for (const line of lines) {
    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;
    const category = cols[1];
    const level = (cols[2] || '').toLowerCase();
    if (!target.has(category)) continue;
    const a = acc[category];
    a.total++;
    if (level === 'повышенный') a.hi++; else a.lo++;
  }

  for (const [cat, a] of Object.entries(acc)) {
    const pct = a.total ? Math.round((a.hi * 100) / a.total) : 0;
    console.log(`${cat}: total=${a.total}, hi=${a.hi}, lo=${a.lo}, hi%=${pct}%`);
  }
}

main();


