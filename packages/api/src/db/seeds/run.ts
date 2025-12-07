// packages/api/src/db/seeds/run.ts
// Run with: bun run src/db/seeds/run.ts

import { db } from '../index';
import {
  downtimeReasons,
  items,
  molds,
  productLines,
  productionSupervisors,
  routing,
  shiftBreaks,
  shifts,
  users,
  workCenters,
} from '../schema';
import { ensureShiftSchedule, seedCalendar } from './calendar';
import { moldSeeds } from './molds';
import { machinePartSeeds, partSeeds } from './parts';
import {
  downtimeReasonSeeds,
  productLineSeeds,
  productionSupervisorSeeds,
  shiftBreakSeeds,
  shiftSeeds,
  userSeeds,
} from './reference-data';
import { seedScrapReasons } from './scrap-reasons';
import { workCenterSeeds } from './work-centers';

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
        },
      });
  }
  console.log(`    ✓ ${shiftSeeds.length} shifts`);

  // Seed shift breaks
  console.log('  → Inserting shift breaks...');
  for (const brk of shiftBreakSeeds) {
    await db.insert(shiftBreaks).values(brk).onConflictDoNothing();
  }
  console.log(`    ✓ ${shiftBreakSeeds.length} shift breaks`);

  // Seed plant calendar (current year + next year)
  console.log('  → Seeding plant calendar...');
  await seedCalendar();

  // Ensure shift instances for next 42 days
  console.log('  → Generating shift instances...');
  await ensureShiftSchedule(42);

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

  // Seed work centers (formerly machines)
  console.log('  → Inserting work centers...');
  for (const wc of workCenterSeeds) {
    await db.insert(workCenters).values(wc).onConflictDoNothing();
  }
  console.log(`    ✓ ${workCenterSeeds.length} work centers`);

  // Seed production supervisors (must be before items due to FK)
  console.log('  → Inserting production supervisors...');
  for (const sup of productionSupervisorSeeds) {
    await db.insert(productionSupervisors).values(sup).onConflictDoNothing();
  }
  console.log(`    ✓ ${productionSupervisorSeeds.length} production supervisors`);

  // Seed items (formerly parts)
  console.log('  → Inserting items...');
  for (const item of partSeeds) {
    await db.insert(items).values(item).onConflictDoNothing();
  }
  console.log(`    ✓ ${partSeeds.length} items`);

  // Seed molds (must be before routing due to FK)
  console.log('  → Inserting molds...');
  for (const mold of moldSeeds) {
    await db.insert(molds).values(mold).onConflictDoNothing();
  }
  console.log(`    ✓ ${moldSeeds.length} molds`);

  // Seed routing (formerly machine-parts)
  console.log('  → Inserting routing...');
  for (const route of machinePartSeeds) {
    await db.insert(routing).values(route).onConflictDoNothing();
  }
  console.log(`    ✓ ${machinePartSeeds.length} routings`);

  // Seed scrap reasons
  await seedScrapReasons();

  console.log('\n✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
