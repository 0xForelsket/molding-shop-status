import { db } from '../index';
import { routing } from '../schema';

async function check() {
  const all = await db.select().from(routing);
  console.log(`Total rows: ${all.length}`);

  // simple in-memory check
  const seen = new Set();
  const duplicates = [];

  for (const row of all) {
    const key = `${row.itemNumber}-${row.workCenterId}`;
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
