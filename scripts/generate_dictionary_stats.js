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

function readEntries(csvRaw) {
  const hasNewlines = csvRaw.includes('\n');
  const entries = [];
  if (hasNewlines) {
    const lines = csvRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let start = 0;
    if (lines.length && /слово|word/i.test(lines[0])) start = 1;
    for (let i = start; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (!cols.length) continue;
      const word = (cols[0] || '').trim();
      const category = (cols[1] || '').trim();
      const level = (cols[2] || '').trim().toLowerCase();
      if (!word) continue;
      entries.push({ word, category, level });
    }
  } else {
    // старый формат, игнорируем для статистики категорий
    const flat = csvRaw.split(',').map((w) => w.trim()).filter(Boolean);
    for (const w of flat) entries.push({ word: w, category: '', level: '' });
  }
  return entries;
}

function buildStats(entries) {
  const byCategory = new Map();
  let total = 0;
  let elevated = 0; // "повышенный"
  for (const e of entries) {
    total += 1;
    if ((e.level || '').toLowerCase() === 'повышенный') elevated += 1;
    const key = e.category || '';
    if (!byCategory.has(key)) {
      byCategory.set(key, { normal: 0, elevated: 0, total: 0 });
    }
    const o = byCategory.get(key);
    if ((e.level || '').toLowerCase() === 'повышенный') o.elevated += 1; else o.normal += 1;
    o.total += 1;
  }
  return { byCategory, total, elevated };
}

function toMarkdown({ byCategory, total, elevated }) {
  // Сортировка по убыванию общего количества в категории
  const rows = Array.from(byCategory.entries()).sort((a, b) => b[1].total - a[1].total);
  const elevatedPct = total > 0 ? (elevated / total) * 100 : 0;
  const lines = [];
  lines.push(`# Статистика словаря`);
  lines.push('');
  lines.push(`- **Общее количество слов**: ${total}`);
  lines.push(`- **Процент сложных (\"повышенный\")**: ${elevatedPct.toFixed(2)}%`);
  lines.push('');
  // Порядок колонок: Категория | Всего | Обычный | Повышенный
  lines.push('| Категория | Всего | Обычный | Повышенный |');
  lines.push('|---|---:|---:|---:|');
  for (const [category, stats] of rows) {
    const name = category || '(без категории)';
    lines.push(`| ${name} | ${stats.total} | ${stats.normal} | ${stats.elevated} |`);
  }
  lines.push('');
  lines.push(`Итого: обычных — ${total - elevated}, повышенных — ${elevated}, всего — ${total}.`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const csvPath = path.join(__dirname, '..', 'public', 'words.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Файл public/words.csv не найден');
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const entries = readEntries(raw);
  const stats = buildStats(entries);
  const md = toMarkdown(stats);
  const outPath = path.join(__dirname, '..', 'public', 'dictionary_statistics.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ Статистика сохранена: ${path.relative(process.cwd(), outPath)}`);
}

main();


