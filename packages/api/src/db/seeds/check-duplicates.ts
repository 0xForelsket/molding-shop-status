import { db } from '../index';
import { machineParts } from './schema';

async function check() {
  const all = await db.select().from(machineParts);
  console.log(`Total rows: ${all.length}`);

  // simple in-memory check
  const seen = new Set();
  const duplicates = [];

  for (const row of all) {
    const key = `${row.partNumber}-${row.machineId}`;
    if (seen.has(key)) {
      duplicates.push(key);
    }
    seen.add(key);
  }

  console.log(`Duplicates found: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('First 5 duplicates:', duplicates.slice(0, 5));
  }

  process.exit(0);
}

check().catch(console.error);
