import { insert, all, col, today } from './firestore.js';

const RI_MUNICIPALITIES = [
  'Barrington','Bristol','Burrillville','Central Falls','Charlestown','Coventry','Cranston','Cumberland',
  'East Greenwich','East Providence','Exeter','Foster','Glocester','Hopkinton','Jamestown','Johnston',
  'Lincoln','Little Compton','Middletown','Narragansett','New Shoreham','Newport','North Kingstown',
  'North Providence','North Smithfield','Pawtucket','Portsmouth','Providence','Richmond','Scituate',
  'Smithfield','South Kingstown','Tiverton','Warren','Warwick','West Greenwich','West Warwick',
  'Westerly','Woonsocket',
];

export async function seed() {
  const existing = await all('municipalities');
  if (existing.length) { console.log('already seeded'); return; }

  // Municipalities
  let cumberlandId = 0;
  for (const name of RI_MUNICIPALITIES) {
    const m = await insert('municipalities', {
      name, state: 'RI',
      coverage_status: name === 'Cumberland' ? 'partial' : 'planned',
      website: name === 'Cumberland' ? 'https://www.cumberlandri.org' : null,
    });
    if (name === 'Cumberland') cumberlandId = m.id;
  }

  // Agencies
  const agency = async (level: string, name: string, dept: string | null, phone: string | null, email: string | null, address: string | null, website: string | null, muni = true) => {
    const a = await insert('agencies', {
      municipality_id: muni ? cumberlandId : null, level, name,
      department: dept, phone, email, address, website,
    });
    return a.id as number;
  };

  const planningId = await agency('municipal', 'Town of Cumberland', 'Planning & Community Development', '(401) 728-2400', null, '45 Broad Street, Cumberland, RI 02864', 'https://www.cumberlandri.org/180/Planning-Community-Development');
  const buildingId = await agency('municipal', 'Town of Cumberland', 'Building & Zoning Office (Building Official)', '(401) 728-2400', null, '45 Broad Street, Cumberland, RI 02864', 'https://www.cumberlandri.org/168/Building-Zoning');
  const fireId = await agency('municipal', 'Cumberland Fire District', 'Fire Marshal / Life Safety', null, null, 'Cumberland, RI', 'https://www.cumberlandfire.org');
  const dpwId = await agency('municipal', 'Town of Cumberland', 'Department of Public Works (Sewer)', '(401) 728-2400', null, '45 Broad Street, Cumberland, RI 02864', 'https://www.cumberlandri.org/205/Public-Works');
  const waterId = await agency('utility', 'Cumberland Water Department', null, '(401) 658-0666', null, 'Cumberland, RI', 'https://www.cumberlandri.org/221/Water-Department');
  const ridemId = await agency('state', 'RI Department of Environmental Management (RIDEM)', 'Office of Water Resources', '(401) 222-4700', null, '235 Promenade Street, Providence, RI 02908', 'https://dem.ri.gov', false);
  const sbcId = await agency('state', 'RI State Building Code Commission', null, '(401) 889-5550', null, '560 Jefferson Blvd, Warwick, RI 02886', 'https://sbcc.ri.gov', false);
  const fmId = await agency('state', 'RI State Fire Marshal', 'Division of Fire Safety', '(401) 889-5551', null, '560 Jefferson Blvd, Warwick, RI 02886', 'https://firemarshal.ri.gov', false);
  const e911Id = await agency('state', 'RI E 9-1-1 / Local Addressing Authority', null, null, null, null, 'https://www.cumberlandri.org', false);

  // Official sources. last_verified_at reflects when this seed data was curated;
  // the UI must instruct users to re-verify with the authority.
  const source = async (agencyId: number, authority: string, title: string, url: string, summary: string, content: string, feesNote: string | null, processing: string | null) => {
    const s = await insert('official_sources', {
      agency_id: agencyId, authority, title, url, summary, content,
      fees_note: feesNote, processing_estimate: processing,
      last_verified_at: today(), doc_version: 'seed-curated',
      published_date: null, effective_date: null,
    });
    return s.id as number;
  };

  const sPlanning = await source(planningId,
    'Town of Cumberland Planning & Community Development',
    'Cumberland Land Development & Subdivision Review Regulations / Development Review',
    'https://www.cumberlandri.org/180/Planning-Community-Development',
    'Development review for land development projects in Cumberland, administered by the Planning Department and Planning Board under RIGL 45-23 (Development Review Act).',
    `Residential land development projects in Cumberland are reviewed under the Town's Land Development and Subdivision Review Regulations, adopted pursuant to the RI Land Development and Subdivision Review Enabling Act (RIGL 45-23) as amended by the 2023-2024 land use reforms.
Major land development projects (such as multi-unit residential developments) generally follow: Pre-application concept review (optional/recommended), Master Plan (for major projects), Preliminary Plan, and Final Plan stages, with administrative officer certification of completeness at each stage.
Under RIGL 45-23-40/41, the administrative officer must certify an application complete or incomplete within a statutory period (25 days for master plan). Public notice and hearing requirements apply at the master plan and preliminary plan stages for major projects.
Applications are submitted to the Planning Department. Required materials typically include the application form, site plans prepared by a registered professional engineer or land surveyor, existing and proposed conditions plans, utility plans, stormwater management plan, landscaping plan, and the applicable fee per the Town's fee schedule.
Contact the Planning Department at (401) 728-2400 to confirm current submission requirements, meeting schedules, and fees.`,
    'Application fees are set by the Town fee schedule; confirm the current amount with the Planning Department before submitting.',
    'RIGL 45-23 sets statutory review periods (e.g., completeness certification within 25 days for master plan). These are published statutory periods, not guaranteed project timelines.');

  const sRigl = await source(planningId,
    'State of Rhode Island General Laws',
    'RIGL Title 45, Chapter 45-23 — Land Development and Subdivision Review Enabling Act',
    'http://webserver.rilegislature.gov/Statutes/TITLE45/45-23/INDEX.htm',
    'State enabling statute governing land development and subdivision review procedure, completeness certification, review periods, and appeals.',
    `RIGL 45-23 establishes the uniform procedure all RI municipalities must follow for land development and subdivision review. Key procedural provisions include: administrative officer completeness certification deadlines; master plan, preliminary plan and final plan stages for major land development; unified development review allowing the planning board to grant variances/special-use permits concurrently; public hearing and notice requirements; and decision deadlines with default-approval provisions in certain cases. Recent amendments (2023-2024) adjusted thresholds and timelines; always confirm the current statute text.`,
    null,
    'Statutory review periods are defined per application stage in the statute; they are maximum review periods, not predictions of actual project duration.');

  const sBuilding = await source(buildingId,
    'Town of Cumberland Building & Zoning Office',
    'Cumberland Building Permit Applications',
    'https://www.cumberlandri.org/168/Building-Zoning',
    'Building permits for new construction, additions and conversions, issued by the Cumberland Building Official under the RI State Building Code.',
    `Building permits in Cumberland are issued by the Building Official. New residential construction requires a building permit application with construction plans; projects of this scale (multi-unit) require plans stamped by a RI-registered architect or professional engineer.
A building permit for a new land development project is generally issued only after required planning approvals have been granted (prerequisite). Separate electrical, mechanical and plumbing permits are required and are issued to licensed trades-persons.
Permit fees are calculated per the adopted fee schedule based on construction value; confirm the current fee schedule with the Building & Zoning Office at (401) 728-2400.
Inspections are required at prescribed construction milestones, concluding with a Certificate of Occupancy before the building may be occupied.`,
    'Permit fees are based on construction value per the Town fee schedule; confirm before submitting.',
    null);

  const sFire = await source(fmId,
    'RI State Fire Marshal / Cumberland Fire District',
    'Rhode Island Fire Safety Code — Plan Review',
    'https://firemarshal.ri.gov',
    'Fire and life-safety plan review for new residential buildings under the RI Fire Safety Code (RIGL 23-28.1 et seq.).',
    `New multi-unit residential buildings in Rhode Island are subject to the RI Fire Safety Code. Plan review is performed by the State Fire Marshal's office or the local assistant deputy fire marshal (fire district) depending on building type and size. Three-family and larger residential buildings typically require fire plan review and fire protection systems review (e.g., sprinkler and alarm plans) before a building permit is issued, plus inspections and sign-off before occupancy.
Confirm the correct reviewing authority (Cumberland Fire District fire marshal vs. State Fire Marshal) for the specific building type with the Cumberland Fire District.`,
    null,
    null);

  const sSewer = await source(dpwId,
    'Town of Cumberland Department of Public Works',
    'Cumberland Sewer Connection / Sewer Use',
    'https://www.cumberlandri.org/205/Public-Works',
    'Sewer connection permits and sewer capacity review for projects served by public sewer in Cumberland.',
    `Projects connecting to the Cumberland public sewer system require a sewer connection permit from the Department of Public Works, and may require capacity review for multi-unit projects. Cumberland's wastewater is treated through regional facilities; a sewer assessment/connection fee applies per the Town's fee schedule.
If the project site is NOT served by public sewer, an Onsite Wastewater Treatment System (OWTS) permit from RIDEM is required instead.
Confirm sewer availability for the specific parcel with DPW.`,
    'Sewer connection/assessment fees per Town fee schedule; confirm with DPW.',
    null);

  const sWater = await source(waterId,
    'Cumberland Water Department',
    'Cumberland Water Service — New Connections',
    'https://www.cumberlandri.org/221/Water-Department',
    'Water service availability and new connection approvals for projects in the Cumberland water service area.',
    `New developments require confirmation of water service availability and connection approval from the Cumberland Water Department (or the applicable supplier for the parcel). Multi-unit projects may require a water system capacity/fire-flow review. Connection fees apply per the Department's fee schedule. Confirm service area and requirements for the specific parcel.`,
    'Connection fees per the Water Department fee schedule; confirm before design.',
    null);

  const sRidemOwts = await source(ridemId,
    'RI Department of Environmental Management',
    'RIDEM Onsite Wastewater Treatment Systems (OWTS) Program',
    'https://dem.ri.gov/environmental-protection-bureau/water-resources/permitting/onsite-wastewater-treatment',
    'OWTS (septic) permits — required only when a project is not served by public sewer.',
    `If a project is not connected to a public sewer system, RIDEM OWTS rules require a permit for any new or altered onsite wastewater treatment system. Applications are prepared by a licensed OWTS designer and submitted to RIDEM with the applicable fee. This approval is NOT applicable to projects that connect to public sewer.`,
    'OWTS application fees are published by RIDEM; confirm the current fee on the RIDEM website.',
    null);

  const sRidemStorm = await source(ridemId,
    'RI Department of Environmental Management',
    'RIDEM Stormwater Permitting (RIPDES Construction General Permit)',
    'https://dem.ri.gov/environmental-protection-bureau/water-resources/permitting/stormwater',
    'Construction stormwater permitting for land-disturbing activity of one acre or more.',
    `Construction activity disturbing one acre or more of land requires coverage under the RIPDES Construction General Permit, including a Stormwater Pollution Prevention Plan (SWPPP). Projects disturbing less than one acre generally do not require this permit unless part of a larger common plan of development. Applicability depends on actual disturbed area — confirm with RIDEM.`,
    null,
    null);

  const sSbc = await source(sbcId,
    'RI State Building Code Commission',
    'Rhode Island State Building Code (SBC-1)',
    'https://sbcc.ri.gov',
    'The statewide building code adopted under RIGL 23-27.3, administered locally by the municipal building official.',
    `The Rhode Island State Building Code applies statewide and is enforced in Cumberland by the local Building Official. It establishes permit, plan review, inspection, and certificate of occupancy requirements for residential construction.`,
    null,
    null);

  const sE911 = await source(e911Id,
    'Local Addressing Authority / RI E 9-1-1',
    'Address Assignment for New Units',
    'https://www.cumberlandri.org',
    'New dwelling units require official address assignment coordinated through the municipality.',
    `New residential units must receive official address assignments from the municipal addressing authority so emergency services and E 9-1-1 records are accurate. Coordinate with the Town during the permitting process.`,
    null,
    null);

  // Approval types with applicability rules
  // slot: functional role (planning/building/fire/sewer/water/inspections). A municipal
  // type fills its slot for its municipality; a generic statewide type with the same slot
  // is used as fallback for municipalities without verified local data. slot=null types
  // (e.g. RIDEM, E-911) are statewide and always considered.
  const at = async (code: string, name: string, category: string, description: string, agencyId: number | null, rules: object, sourceId: number, municipalityId: number | null = null, slot: string | null = null, isGeneric = false) => {
    await insert('approval_types', {
      code, name, category, description, agency_id: agencyId,
      applicability_rules: rules, source_id: sourceId,
      municipality_id: municipalityId, slot, is_generic: isGeneric,
    });
  };

  await at('planning_major_land_dev', 'Major Land Development Review (Planning Board)', 'planning',
    'Master Plan / Preliminary Plan / Final Plan review by the Cumberland Planning Board for major residential land development projects, per RIGL 45-23 and local regulations.',
    planningId, { min_units: 2, construction_kinds: ['new_construction','conversion','addition'] }, sPlanning, cumberlandId, 'planning');

  await at('building_permit', 'Building Permit', 'building',
    'Building permit from the Cumberland Building Official under the RI State Building Code. Requires stamped plans for multi-unit buildings. Prerequisite: planning approval for land development projects.',
    buildingId, { min_units: 1 }, sBuilding, cumberlandId, 'building');

  await at('fire_plan_review', 'Fire & Life-Safety Plan Review', 'fire',
    'Fire Safety Code plan review (building, sprinkler, alarm) by the fire marshal having jurisdiction, plus pre-occupancy inspections.',
    fireId, { min_units: 3, condition_note: 'Required for 3+ unit buildings; confirm reviewing authority (local vs. state fire marshal) with the Cumberland Fire District.' }, sFire, cumberlandId, 'fire');

  await at('sewer_connection', 'Sewer Connection Permit', 'utility',
    'Sewer connection permit and capacity review from Cumberland DPW for projects served by public sewer.',
    dpwId, { requires: { sewer_service: 'public_sewer' }, conditional_on_unknown: 'sewer_service', condition_note: 'Applies only if the parcel is served by public sewer; confirm availability with DPW.' }, sSewer, cumberlandId, 'sewer');

  await at('ridem_owts', 'RIDEM OWTS (Septic) Permit', 'environmental',
    'Onsite wastewater treatment system permit from RIDEM — only for projects NOT connected to public sewer.',
    ridemId, { requires: { sewer_service: 'septic' }, conditional_on_unknown: 'sewer_service', condition_note: 'Applies only if the project is not served by public sewer.' }, sRidemOwts);

  await at('water_connection', 'Water Service Connection Approval', 'utility',
    'Water availability confirmation and connection approval from the Cumberland Water Department (or applicable supplier).',
    waterId, { requires: { water_service: 'public_water' }, conditional_on_unknown: 'water_service', condition_note: 'Confirm the water supplier and service availability for the parcel.' }, sWater, cumberlandId, 'water');

  await at('ridem_stormwater', 'RIPDES Construction Stormwater Permit', 'environmental',
    'RIDEM construction general permit for land disturbance of one acre or more (SWPPP required).',
    ridemId, { conditional: true, condition_note: 'Required only if construction disturbs one acre or more of land (or is part of a larger common plan). Confirm disturbed area with your engineer and RIDEM.' }, sRidemStorm);

  await at('e911_addressing', 'Address Assignment (E 9-1-1)', 'state',
    'Official address assignment for new dwelling units.',
    e911Id, { min_units: 1, construction_kinds: ['new_construction','conversion'] }, sE911);

  await at('inspections_co', 'Construction Inspections & Certificate of Occupancy', 'inspection',
    'Required construction milestone inspections (building, electrical, mechanical, plumbing, fire) and final Certificate of Occupancy from the Building Official.',
    buildingId, { min_units: 1 }, sSbc, cumberlandId, 'inspections');


  // Generic statewide fallbacks for municipalities without verified local data.
  // Grounded only in statewide frameworks (RIGL 45-23, State Building Code, Fire Safety Code).
  await at('planning_generic', 'Municipal Land Development Review', 'planning',
    'Land development / subdivision review by the municipal planning board under RIGL 45-23. Local submission requirements are not yet verified on this platform — confirm with the municipal planning department.',
    sbcId, { min_units: 2 }, sRigl, null, 'planning', true);

  await at('building_permit_generic', 'Building Permit', 'building',
    'Building permit from the municipal building official under the RI State Building Code. Confirm local application requirements with the building office.',
    sbcId, { min_units: 1 }, sSbc, null, 'building', true);

  await at('fire_generic', 'Fire & Life-Safety Plan Review', 'fire',
    'Fire Safety Code plan review by the fire marshal having jurisdiction. Confirm the reviewing authority for this municipality and building type.',
    fmId, { min_units: 3, condition_note: 'Required for 3+ unit buildings; confirm the reviewing authority (local vs. state fire marshal).' }, sFire, null, 'fire', true);

  await at('sewer_generic', 'Sewer Connection / Wastewater Approval', 'utility',
    'Sewer connection approval from the municipal sewer authority for parcels on public sewer. If the parcel is not served by sewer, a RIDEM OWTS permit applies instead.',
    sbcId, { requires: { sewer_service: 'public_sewer' }, conditional_on_unknown: 'sewer_service', condition_note: 'Applies only if the parcel is served by public sewer; confirm availability with the municipal sewer authority.' }, sRigl, null, 'sewer', true);

  await at('water_generic', 'Water Service Connection Approval', 'utility',
    'Water availability confirmation and connection approval from the water supplier serving the parcel.',
    sbcId, { requires: { water_service: 'public_water' }, conditional_on_unknown: 'water_service', condition_note: 'Confirm the water supplier and service availability for the parcel.' }, sRigl, null, 'water', true);

  await at('inspections_generic', 'Construction Inspections & Certificate of Occupancy', 'inspection',
    'Required construction milestone inspections and final Certificate of Occupancy from the municipal building official under the RI State Building Code.',
    sbcId, { min_units: 1 }, sSbc, null, 'inspections', true);

  console.log('seed complete');
}
