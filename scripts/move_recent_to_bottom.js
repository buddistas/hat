/*
  Move recently added words to the bottom of public/words.csv without duplication.

  Strategy:
  - Use the latest backup created BEFORE the recent additions as the baseline (if a specific
    backup is desired, set BASELINE_NAME below). Otherwise, pick the earliest backup from today
    or the most recent backup prior to the current words.csv modification.
  - Compute the set of rows present in current words.csv but absent in baseline (by normalized word only).
  - Preserve the relative order of these "new" rows as they appear now.
  - Reconstruct words.csv: first all baseline-present rows in their current order, then append new rows.
  - Keep the header if present.
*/

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CSV_PATH = path.join(PUBLIC_DIR, 'words.csv');

const BASELINE_NAME = 'words_backup_2025-09-25T07-10-21-060Z.csv'; // pin baseline prior to additions

function collapseSpaces(s) {
  return String(s).replace(/\s+/g, ' ').trim();
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
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(x => x.trim());
}

function readCsvRecords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const hasHeader = lines.length > 0 && /(слово|word)/i.test(lines[0]);
  const header = hasHeader ? lines[0] : null;
  const start = hasHeader ? 1 : 0;
  const records = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const word = cols[0] || '';
    const category = cols[1] || '';
    const level = cols[2] || '';
    if (!word) continue;
    records.push({ word, category, level, line });
  }
  return { header, records };
}

function pickBaselineFile() {
  if (BASELINE_NAME) {
    const p = path.join(PUBLIC_DIR, BASELINE_NAME);
    if (!fs.existsSync(p)) {
      console.error(`Specified baseline not found: ${p}`);
      process.exit(1);
    }
    return p;
  }
  const files = fs.readdirSync(PUBLIC_DIR)
    .filter(f => /^words_backup_\d{4}-\d{2}-\d{2}T/.test(f) && f.endsWith('.csv'))
    .sort();
  if (!files.length) {
    console.error('No backups found in public/');
    process.exit(1);
  }
  // Heuristic: pick the latest backup before the current time (last in sort order)
  // If normalize_words created a backup just now, that is still a valid baseline because
  // our goal is to group "recently added" rows; using any prior snapshot yields the delta.
  return path.join(PUBLIC_DIR, files[files.length - 1]);
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('public/words.csv not found');
    process.exit(1);
  }

  const baselinePath = pickBaselineFile();
  const { header, records } = readCsvRecords(CSV_PATH);
  const baselineRecords = readCsvRecords(baselinePath).records;

  const baselineSet = new Set(baselineRecords.map(r => normalizeWordForSet(r.word)));

  const currentOrderNew = [];
  const currentOrderBaseline = [];
  for (const r of records) {
    const key = normalizeWordForSet(r.word);
    if (baselineSet.has(key)) {
      currentOrderBaseline.push(r);
    } else {
      currentOrderNew.push(r);
    }
  }

  const outLines = [];
  if (header) outLines.push(header);
  // Preserve original CSV formatting (including quotes) by writing stored original lines
  for (const r of currentOrderBaseline) outLines.push(r.line);
  for (const r of currentOrderNew) outLines.push(r.line);

  const out = outLines.join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, out);
  console.log(`Moved ${currentOrderNew.length} rows to bottom. Baseline: ${path.basename(baselinePath)}`);
}

main();


