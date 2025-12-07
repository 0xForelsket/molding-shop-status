import * as path from 'node:path';
import * as XLSX from 'xlsx';

const filePath = path.resolve('/home/bazzite/projects/molding-shop-status/docs/data molding.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = data[0] as string[];
const rows = data.slice(1) as unknown[][];

const uniqueProcess = new Set();

for (const row of rows) {
  const r = row as unknown[];
  const getVal = (name: string) => {
    const idx = headers.indexOf(name);
    return idx !== -1 ? r[idx] : undefined;
  };

  const process = getVal('PROCESS');
  if (process) uniqueProcess.add(process);
}

console.log('Unique PROCESS values:', Array.from(uniqueProcess));

// Check a few rows where Cycle Time IS present
const validCycleRows = rows
  .filter((r) => {
    const idx = headers.indexOf('CYCLE TIME PLAN');
    return r[idx] != null;
  })
  .slice(0, 3);

if (validCycleRows.length > 0) {
  console.log('\nSample rows with Cycle Time:');
  console.log(JSON.stringify(validCycleRows, null, 2));
} else {
  console.log('\nWARNING: No rows with CYCLE TIME PLAN found.');
}
