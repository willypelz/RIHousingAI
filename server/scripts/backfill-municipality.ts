/** One-off backfill: tag existing approval_types with municipality/slot and add
 *  generic statewide fallback types for municipalities without verified data. */
import 'dotenv/config';
import { all, col, insert } from '../src/db/firestore.js';

const SLOTS: Record<string, string> = {
  planning_major_land_dev: 'planning',
  building_permit: 'building',
  fire_plan_review: 'fire',
  sewer_connection: 'sewer',
  water_connection: 'water',
  inspections_co: 'inspections',
};

async function run() {
  const munis = await all('municipalities');
  const cumberlandId = munis.find(m => m.name === 'Cumberland')!.id;
  const types = await all('approval_types');
  const sources = await all('official_sources');
  const agencies = await all('agencies');

  for (const t of types) {
    if (t.is_generic) continue;
    const slot = SLOTS[t.code] ?? null;
    await col('approval_types').doc(String(t.id)).update({
      municipality_id: slot ? cumberlandId : null,
      slot,
      is_generic: t.is_generic ?? false,
    });
    console.log('tagged', t.code, slot ? `-> Cumberland/${slot}` : '-> statewide');
  }

  const sRigl = sources.find(s => s.title.includes('45-23'))?.id ?? null;
  const sSbc = sources.find(s => s.title.includes('State Building Code'))?.id ?? null;
  const sFire = sources.find(s => s.title.includes('Fire Safety Code'))?.id ?? null;
  const fmId = agencies.find(a => a.name.includes('Fire Marshal'))?.id ?? null;

  const generics = [
    ['planning_generic', 'Municipal Land Development Review', 'planning',
      'Land development / subdivision review by the municipal planning board under RIGL 45-23. Local submission requirements are not yet verified on this platform — confirm with the municipal planning department.',
      null, { min_units: 2 }, sRigl, 'planning'],
    ['building_permit_generic', 'Building Permit', 'building',
      'Building permit from the municipal building official under the RI State Building Code. Confirm local application requirements with the building office.',
      null, { min_units: 1 }, sSbc, 'building'],
    ['fire_generic', 'Fire & Life-Safety Plan Review', 'fire',
      'Fire Safety Code plan review by the fire marshal having jurisdiction. Confirm the reviewing authority for this municipality and building type.',
      fmId, { min_units: 3, condition_note: 'Required for 3+ unit buildings; confirm the reviewing authority (local vs. state fire marshal).' }, sFire, 'fire'],
    ['sewer_generic', 'Sewer Connection / Wastewater Approval', 'utility',
      'Sewer connection approval from the municipal sewer authority for parcels on public sewer. If the parcel is not served by sewer, a RIDEM OWTS permit applies instead.',
      null, { requires: { sewer_service: 'public_sewer' }, conditional_on_unknown: 'sewer_service', condition_note: 'Applies only if the parcel is served by public sewer; confirm availability with the municipal sewer authority.' }, sRigl, 'sewer'],
    ['water_generic', 'Water Service Connection Approval', 'utility',
      'Water availability confirmation and connection approval from the water supplier serving the parcel.',
      null, { requires: { water_service: 'public_water' }, conditional_on_unknown: 'water_service', condition_note: 'Confirm the water supplier and service availability for the parcel.' }, sRigl, 'water'],
    ['inspections_generic', 'Construction Inspections & Certificate of Occupancy', 'inspection',
      'Required construction milestone inspections and final Certificate of Occupancy from the municipal building official under the RI State Building Code.',
      null, { min_units: 1 }, sSbc, 'inspections'],
  ] as const;

  for (const [code, name, category, description, agencyId, rules, sourceId, slot] of generics) {
    if (types.some(t => t.code === code)) { console.log('exists', code); continue; }
    await insert('approval_types', {
      code, name, category, description, agency_id: agencyId,
      applicability_rules: rules, source_id: sourceId,
      municipality_id: null, slot, is_generic: true,
    });
    console.log('added', code);
  }
  console.log('backfill complete');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
