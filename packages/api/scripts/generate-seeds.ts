import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { partSeeds } from '../src/db/seeds/parts';

// Map of PROCESS to Work Center ID
const processToId: Record<string, number> = {
  IM01: 1,
  IM02: 2,
  IM03: 3,
  IM04: 4,
  IM05: 5,
  IM06: 6,
  IM07: 7,
  IM08: 8,
  IM09: 9,
  IM10: 10,
  IM11: 11,
  IM12: 12,
  IM13: 13,
  IM14: 14,
  'IM15-2K': 15,
  'IM16-2K': 16,
  IM17: 17,
  'IM18-2K': 18,
  // Map aliases
  GUPPY: 1, // Assumption based on context or need to ask user? Let's map to 1 for now or log warning
  'Q-Plas': 2, // Assumption
};

const filePath = path.resolve('/home/bazzite/projects/molding-shop-status/docs/data molding.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const headers = data[0] as string[];
const rows = data.slice(1) as unknown[][];

const validItemNumbers = new Set(partSeeds.map((p) => p.itemNumber));
interface MoldSeed {
  id: string;
  name: string;
  cavities: number;
  runnerType: string;
  gateType: string;
  status: string;
}

interface RoutingSeed {
  workCenterId: number;
  itemNumber: string;
  moldId: string;
  cycleTime: number;
  outputQty: number;
  setupTime: number;
}

interface PartUpdate {
  itemNumber: string;
  partWeight?: number;
  runnerWeight?: number;
  material?: string;
}

const generatedMolds = new Map<string, MoldSeed>();
const generatedRoutings: RoutingSeed[] = [];
const updatedParts = new Map<string, PartUpdate>();

// Helper to get column value
const getVal = (row: unknown[], name: string) => {
  const idx = headers.indexOf(name);
  return idx !== -1 ? row[idx] : undefined;
};

for (const row of rows) {
  const itemNumber = getVal(row, 'PART NO.') as string | undefined;
  if (!itemNumber || !validItemNumbers.has(itemNumber)) continue;

  // 1. Update Part Info
  const partWeight = getVal(row, 'Part Weight (gram)');
  const runnerWeight = getVal(row, 'Runner Weight (gram)');
  const material = getVal(row, 'MATERIAL NAME');

  if (!updatedParts.has(itemNumber)) {
    updatedParts.set(itemNumber, {
      itemNumber,
      partWeight: typeof partWeight === 'number' ? partWeight : undefined,
      runnerWeight: typeof runnerWeight === 'number' ? runnerWeight : undefined,
      material: typeof material === 'string' ? material : undefined,
    });
  }

  // 2. Generate Mold
  const moldNo = getVal(row, 'MOLD NO.') as string | undefined;
  const moldId = moldNo ? moldNo.trim() : `MLD-${itemNumber}`; // Fallback if missing

  if (!generatedMolds.has(moldId)) {
    generatedMolds.set(moldId, {
      id: moldId,
      name: `Mold for ${itemNumber}`, // Could use 'Mold Name' column if exists
      cavities: (getVal(row, 'CAVITY PLAN') as number) || 1,
      runnerType: 'cold', // Default, logic could be improved if data exists
      gateType: 'sub', // Default
      status: 'active',
    });
  }

  // 3. Generate Routing
  const process = getVal(row, 'PROCESS') as string;
  const workCenterId = processToId[process];

  if (workCenterId) {
    generatedRoutings.push({
      workCenterId,
      itemNumber,
      moldId,
      cycleTime: (getVal(row, 'CYCLE TIME PLAN') as number) || 0,
      outputQty: (getVal(row, 'CAVITY PLAN') as number) || 1,
      setupTime: 60, // Default
    });
  }
}

// Output results
// console.log('// Generated Molds');
// console.log(`export const moldSeeds = ${JSON.stringify(Array.from(generatedMolds.values()), null, 2)};`);

// console.log('\n// Generated Routing');
// console.log(`export const machinePartSeeds = ${JSON.stringify(generatedRoutings, null, 2)};`);

// Merge updates into partSeeds
const mergedPartSeeds = partSeeds.map((part) => {
  const update = updatedParts.get(part.itemNumber);
  if (update) {
    return {
      ...part,
      partWeight: update.partWeight as number,
      runnerWeight: update.runnerWeight as number,
      // material: update.material, // We don't have a material column in items yet? schema says 'materialType' and 'density'/'meltTemp'.
      // Let's map material name to notes or something if needed, but schema has specific fields.
      // For now, just weights.
    };
  }
  return part;
});

console.log('// Merged Part Seeds');
console.log(`export const partSeeds = ${JSON.stringify(mergedPartSeeds, null, 2)};`);
