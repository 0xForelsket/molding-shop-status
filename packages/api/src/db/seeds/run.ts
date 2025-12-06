// packages/api/src/db/seeds/run.ts
// Run with: bun run src/db/seeds/run.ts

import { db } from '../index';
import {
  downtimeReasons,
  machineParts,
  machines,
  parts,
  productLines,
  shifts,
  users,
} from '../schema';
import { machineSeeds } from './machines';
import { machinePartSeeds, partSeeds } from './parts';
import { downtimeReasonSeeds, productLineSeeds, shiftSeeds, userSeeds } from './reference-data';

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Seed/update shifts
  console.log('  → Upserting shifts...');
  for (const shift of shiftSeeds) {
    await db
      .insert(shifts)
      .values(shift)
      .onConflictDoUpdate({
        target: shifts.id,
        set: {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakStartTime: shift.breakStartTime,
          breakEndTime: shift.breakEndTime,
          breakDurationMinutes: shift.breakDurationMinutes,
        },
      });
  }
  console.log(`    ✓ ${shiftSeeds.length} shifts`);

  // Seed downtime reasons
  console.log('  → Inserting downtime reasons...');
  for (const reason of downtimeReasonSeeds) {
    await db.insert(downtimeReasons).values(reason).onConflictDoNothing();
  }
  console.log(`    ✓ ${downtimeReasonSeeds.length} downtime reasons`);

  // Seed product lines
  console.log('  → Inserting product lines...');
  for (const line of productLineSeeds) {
    await db.insert(productLines).values(line).onConflictDoNothing();
  }
  console.log(`    ✓ ${productLineSeeds.length} product lines`);

  // Seed users
  console.log('  → Inserting users...');
  for (const user of userSeeds) {
    await db.insert(users).values(user).onConflictDoNothing();
  }
  console.log(`    ✓ ${userSeeds.length} users`);

  // Seed machines
  console.log('  → Inserting machines...');
  for (const machine of machineSeeds) {
    await db.insert(machines).values(machine).onConflictDoNothing();
  }
  console.log(`    ✓ ${machineSeeds.length} machines`);

  // Seed parts
  console.log('  → Inserting parts...');
  for (const part of partSeeds) {
    await db.insert(parts).values(part).onConflictDoNothing();
  }
  console.log(`    ✓ ${partSeeds.length} parts`);

  // Seed machine-part relationships
  console.log('  → Inserting machine-part mappings...');
  for (const mp of machinePartSeeds) {
    await db.insert(machineParts).values(mp).onConflictDoNothing();
  }
  console.log(`    ✓ ${machinePartSeeds.length} machine-part mappings`);

  console.log('\n✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
