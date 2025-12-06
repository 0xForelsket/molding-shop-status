import { db } from '../index';
import { scrapReasons } from '../schema';

export async function seedScrapReasons() {
  console.log('Seeding scrap reasons...');

  const reasons = [
    { code: 'SHORT', name: 'Short Mold', category: 'process' },
    { code: 'FLASH', name: 'Flash', category: 'process' },
    { code: 'BURN', name: 'Burn Marks', category: 'visual' },
    { code: 'SINK', name: 'Sink Marks', category: 'visual' },
    { code: 'WARP', name: 'Warpage', category: 'dimensional' },
    { code: 'CONTAM', name: 'Contamination', category: 'visual' },
    { code: 'DIM', name: 'Dimensional', category: 'dimensional' },
    { code: 'OTHER', name: 'Other', category: 'general' },
  ];

  await db.insert(scrapReasons).values(reasons).onConflictDoNothing();

  console.log('Scrap reasons seeded!');
}
