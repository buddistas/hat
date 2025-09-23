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
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let i = 0;
  if (lines.length && /слово|word/i.test(lines[0])) i = 1;
  const counts = new Map();
  for (; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const category = (cols[1] || '').trim() || '__без_категории__';
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of arr) {
    console.log(String(count).padStart(5, ' ') + '  ' + category);
  }
}

main();


