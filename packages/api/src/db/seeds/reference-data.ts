// Seed data for shifts, downtime reasons, product lines, and users

// Shifts - Day and Night only
export const shiftSeeds = [
  { id: 1, name: 'Day Shift', startTime: '07:00', endTime: '19:00' },
  { id: 2, name: 'Night Shift', startTime: '19:00', endTime: '07:00' },
];

// Downtime Reasons - categorized for reporting
export const downtimeReasonSeeds = [
  // Planned downtime
  { code: 'MOLD_CHANGE', name: 'Mold Change', category: 'planned', isActive: true },
  { code: 'MAINTENANCE', name: 'Scheduled Maintenance', category: 'planned', isActive: true },
  { code: 'STARTUP', name: 'Machine Startup/Warmup', category: 'planned', isActive: true },
  { code: 'CLEANING', name: 'Mold/Machine Cleaning', category: 'planned', isActive: true },
  { code: 'BREAK', name: 'Operator Break', category: 'planned', isActive: true },
  { code: 'TRIAL', name: 'Trial/Sample Run', category: 'planned', isActive: true },

  // Unplanned downtime
  { code: 'BREAKDOWN', name: 'Machine Breakdown', category: 'unplanned', isActive: true },
  { code: 'MATERIAL_SHORTAGE', name: 'Material Shortage', category: 'unplanned', isActive: true },
  { code: 'QUALITY_ISSUE', name: 'Quality Issue', category: 'unplanned', isActive: true },
  { code: 'NO_OPERATOR', name: 'No Operator Available', category: 'unplanned', isActive: true },
  { code: 'MOLD_ISSUE', name: 'Mold Problem', category: 'unplanned', isActive: true },
  { code: 'ROBOT_ISSUE', name: 'Robot/EOAT Problem', category: 'unplanned', isActive: true },
  { code: 'WAITING_QC', name: 'Waiting for QC Approval', category: 'unplanned', isActive: true },
  { code: 'OTHER', name: 'Other', category: 'unplanned', isActive: true },
];

// Product Lines - extracted from parts data
export const productLineSeeds = [
  { code: 'WAVE_1_1', name: 'Wave 1.1', isActive: true },
  { code: 'WAVE_2', name: 'Wave 2', isActive: true },
  { code: 'WAVE_3', name: 'Wave 3', isActive: true },
  { code: 'WAVE_4', name: 'Wave 4', isActive: true },
  { code: 'KEPLER_BT9', name: 'Kepler BT-9', isActive: true },
  { code: 'KEPLER_S5_S7', name: 'Kepler-S5/S7', isActive: true },
  { code: 'KEPLER_S5', name: 'Kepler-S5', isActive: true },
  { code: 'KEPLER_CAMO', name: 'Kepler Camouflage', isActive: true },
  { code: 'S3_USB', name: 'S3 USB', isActive: true },
  { code: 'GILLETTE_I3', name: 'Gillette Labs 715-i3', isActive: true },
  { code: 'GILLETTE_I7', name: 'Gillette Labs 715-i7', isActive: true },
  { code: 'BEOWULF', name: 'Beowulf ii', isActive: true },
  { code: 'METAL_HEAD', name: 'Metal Head Localization', isActive: true },
  { code: 'WALMART', name: 'Walmart', isActive: true },
];

// Users - initial accounts (passwords should be changed!)
export const userSeeds = [
  { username: 'admin', role: 'admin', name: 'System Administrator', isActive: true },
  { username: 'planner', role: 'planner', name: 'Production Planner', isActive: true },
  { username: 'leader1', role: 'line_leader', name: 'Line Leader 1', isActive: true },
  { username: 'leader2', role: 'line_leader', name: 'Line Leader 2', isActive: true },
  { username: 'viewer', role: 'viewer', name: 'Dashboard Viewer', isActive: true },
];
