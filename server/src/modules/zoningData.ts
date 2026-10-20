/** Zoning reference data. Links curated from RI Statewide Planning Technical Paper 172
 *  (Appendix B, Feb 2025), Technical Paper 173 (Aug 2026), RIGIS, and the RI Zoning Atlas.
 *  Checked October 2026. This platform links to official sources — it does not make
 *  zoning determinations; the legal answer comes from the town's ordinance and official map. */

export const ZONING_LINKS_CHECKED = '2026-10-07';

export interface OrdinanceLink { platform: string; where: string | null; url: string; }

/** Zoning ordinance location for all 39 municipalities (TP172 Appendix B). */
export const ORDINANCE_LINKS: Record<string, OrdinanceLink> = {
  'Barrington': { platform: 'eCode360', where: null, url: 'https://ecode360.com/7120841' },
  'Bristol': { platform: 'Municode', where: 'Chapter 28', url: 'https://library.municode.com/ri/bristol/codes/code_of_ordinances' },
  'Burrillville': { platform: 'Municode', where: 'Chapter 30', url: 'https://library.municode.com/ri/burrillville' },
  'Central Falls': { platform: 'Municode', where: 'Revised Ordinances, Part II, Appendix A', url: 'https://library.municode.com/ri/central_falls/codes/code_of_ordinances' },
  'Charlestown': { platform: 'eCode360', where: null, url: 'https://ecode360.com/8492633' },
  'Coventry': { platform: 'eCode360', where: 'Chapter 255', url: 'https://ecode360.com/6648479' },
  'Cranston': { platform: 'Municode', where: 'Chapter 17', url: 'https://library.municode.com/ri/cranston' },
  'Cumberland': { platform: 'eCode360', where: 'Code of Ordinances, Appendix B', url: 'https://ecode360.com/30187156' },
  'East Greenwich': { platform: 'eCode360', where: 'Chapter 260', url: 'https://ecode360.com/13130364' },
  'East Providence': { platform: 'Municode', where: 'City Code, Zoning chapter', url: 'https://library.municode.com/ri/east_providence' },
  'Exeter': { platform: 'Municode', where: null, url: 'https://library.municode.com/ri/exeter' },
  'Foster': { platform: 'Municode', where: 'Chapter 38', url: 'https://library.municode.com/ri/foster' },
  'Glocester': { platform: 'eCode360', where: 'Chapter 350', url: 'https://ecode360.com/9717353' },
  'Hopkinton': { platform: 'Municode', where: 'Appendix A', url: 'https://library.municode.com/ri/hopkinton' },
  'Jamestown': { platform: 'Municode', where: 'Chapter 82', url: 'https://library.municode.com/ri/jamestown' },
  'Johnston': { platform: 'eCode360', where: 'Chapter 340', url: 'https://ecode360.com/28282232' },
  'Lincoln': { platform: 'eCode360', where: 'Chapter 260', url: 'https://ecode360.com/12125764' },
  'Little Compton': { platform: 'eCode360', where: 'Town Code, Chapter XIV', url: 'https://ecode360.com/35244527' },
  'Middletown': { platform: 'American Legal Publishing', where: 'Title XV, Chapter 152', url: 'https://codelibrary.amlegal.com/codes/middletown/latest/middletown_ri/0-0-0-6285' },
  'Narragansett': { platform: 'Municode', where: 'Appendix A', url: 'https://library.municode.com/ri/narragansett' },
  'New Shoreham': { platform: 'ClerksHQ', where: 'Zoning Ordinance', url: 'https://clerkshq.com/NewShorehamRI?docId=NShoreAppE&path=NewShoreham_Code%2CNShoreP2%2CNShoreAppE%2C' },
  'Newport': { platform: 'Municode', where: null, url: 'https://library.municode.com/ri/newport' },
  'North Kingstown': { platform: 'Municode', where: 'Chapter 21', url: 'https://library.municode.com/ri/north_kingstown' },
  'North Providence': { platform: 'Town website (PDF)', where: 'Whole file is the zoning ordinance', url: 'https://northprovidenceri.gov/pdf/plan/North_Providence_Zoning_Ordinance_amended.pdf' },
  'North Smithfield': { platform: 'eCode360', where: null, url: 'https://ecode360.com/NO4256' },
  'Pawtucket': { platform: 'eCode360', where: 'Chapter 410', url: 'https://ecode360.com/8132886' },
  'Portsmouth': { platform: 'eCode360', where: 'Chapter 405', url: 'https://ecode360.com/32075192' },
  'Providence': { platform: 'Municode', where: 'Chapter 27', url: 'https://library.municode.com/ri/providence/codes/code_of_ordinances' },
  'Richmond': { platform: 'ClerksHQ', where: 'Title 18', url: 'https://clerkshq.com/richmond-ri' },
  'Scituate': { platform: 'Municode', where: null, url: 'https://library.municode.com/ri/scituate' },
  'Smithfield': { platform: 'eCode360', where: null, url: 'https://ecode360.com/SM2013' },
  'South Kingstown': { platform: 'Municode', where: null, url: 'https://library.municode.com/ri/south_kingstown' },
  'Tiverton': { platform: 'Municode', where: 'Appendix A', url: 'https://library.municode.com/ri/tiverton' },
  'Warren': { platform: 'Municode', where: 'Chapter 32', url: 'https://library.municode.com/ri/warren/codes/zoning_ordinance' },
  'Warwick': { platform: 'Town website', where: 'Zoning ordinance page', url: 'https://www.warwickri.gov/city-council-legislative-department/pages/zoning-ordinances' },
  'West Greenwich': { platform: 'eCode360', where: 'Chapter 450', url: 'https://ecode360.com/31440174' },
  'West Warwick': { platform: 'Municode', where: null, url: 'https://library.municode.com/ri/west_warwick' },
  'Westerly': { platform: 'eCode360', where: 'Chapter 260', url: 'https://ecode360.com/7756211' },
  'Woonsocket': { platform: 'ClerksHQ', where: 'City Code, Appendix C', url: 'https://clerkshq.com/Content/Woonsocket-ri/books/code/woonappc.htm' },
};

/** Statewide map tools to find a parcel's district (the legal answer is the town's official map). */
export const MAP_TOOLS = [
  { name: 'Rhode Island Zoning Atlas (all 39 towns on one map)', url: 'https://experience.arcgis.com/experience/e9b8450970b643ee9dd71188ce59e766/', note: 'Shows each district and whether 1/2/3/4+ unit housing is allowed by right or by hearing. Use it to find the district, then confirm in the ordinance.' },
  { name: 'RIGIS Zoning and Overlay Zones layer', url: 'https://www.rigis.org/maps/c8d4094c9141466eb6d3e9d82c349dd8', note: 'Every town\u2019s districts and overlays in one statewide GIS layer (generalized for planning).' },
  { name: 'Municipal GIS resources (official town maps)', url: 'https://www.rigis.org/pages/municipal-gis-resources', note: 'Per-town links to official online maps and PDF zoning maps \u2014 the best source for the legal district boundary.' },
];

/** Dimensional items to check in the ordinance's use + dimensional tables. Values are
 *  intentionally blank — they must be read from the town's ordinance for the district. */
export const DIMENSIONAL_CHECKS = [
  { key: 'min_lot_size', label: 'Minimum lot size', hint: 'Dimensional table for your district (sq ft or acres).' },
  { key: 'frontage', label: 'Minimum frontage', hint: 'Dimensional table; some districts also set lot width.' },
  { key: 'setbacks', label: 'Setbacks (front / side / rear)', hint: 'Dimensional table; corner lots often differ.' },
  { key: 'height_limit', label: 'Height limit', hint: 'Dimensional table (feet and/or stories).' },
  { key: 'units_by_right', label: 'Units allowed by right', hint: 'Use table for your district; the RI Zoning Atlas summarizes 1/2/3/4+ unit allowances.' },
  { key: 'lot_coverage', label: 'Maximum lot coverage', hint: 'Dimensional table (% of lot).' },
  { key: 'parking', label: 'Off-street parking required', hint: 'Parking section; note the 2026 transit parking cap (RIGL 45-24-33).' },
];

export interface StateReform {
  code: string; name: string; statute: string; bill: string; effective: string;
  summary: string;
  relevance: (p: { units: number; construction_kind: string }) => string | null;
}

/** RI 2024–2026 housing reforms that can change what a lot can hold.
 *  Source: Statewide Planning Technical Paper 173 (Aug 26, 2026). Confirm current statute text before relying on any entry. */
export const STATE_REFORMS: StateReform[] = [
  {
    code: 'adu', name: 'Accessory dwelling units (ADUs)',
    statute: 'RIGL 45-24-73, 45-24-37', bill: '2024 H7062A / S2998A', effective: '2024-06-25',
    summary: 'One ADU per lot is allowed by right (building permit only) in three situations: as a family-disability accommodation on an owner-occupied property; on a residential lot of 20,000 sq ft or more; or within the existing footprint of the home or an accessory structure. Towns must allow at least 900 sq ft (studio/1-bed) or 1,200 sq ft (2-bed), or 60% of the main home\u2019s floor area, whichever is less.',
    relevance: () => 'If the lot keeps or adds a single-family home, an ADU may add a unit by right without zoning relief.',
  },
  {
    code: 'townhouses', name: 'Townhouses permitted',
    statute: 'RIGL 45-24-33, 45-24-37', bill: '2025 H5798A / S1083A', effective: '2026-01-01',
    summary: 'Attached single-family dwellings are a permitted use in residential districts that allow two or more units, up to the district\u2019s residential density.',
    relevance: (p) => p.units >= 2 ? 'Your multi-unit project may be able to use a townhouse configuration as a permitted use if the district allows 2+ units.' : null,
  },
  {
    code: 'commercial_housing', name: 'Housing in commercial districts',
    statute: 'RIGL 45-24-33', bill: '2025 H5800A / S1090A', effective: '2026-01-01',
    summary: 'Zoning must provide for residential development in all or some commercial districts, subject to objective standards.',
    relevance: () => 'If the parcel is in a commercial district, residential use may now be available where it previously was not.',
  },
  {
    code: 'usb_multifamily', name: 'Beyond single-family where water and sewer exist',
    statute: 'RIGL 45-24-33', bill: '2025 H5796 / S1092', effective: '2026-01-01',
    summary: 'In towns with land inside the Urban Services Boundary, zoning must provide residential options other than detached single-family homes where public water and sewer capacity is available.',
    relevance: (p) => p.units >= 2 ? 'If the parcel has public water and sewer inside the Urban Services Boundary, options beyond single-family must exist in the zoning.' : null,
  },
  {
    code: 'adaptive_reuse', name: 'Adaptive reuse of commercial buildings',
    statute: 'RIGL 45-24-31, 45-24-37', bill: '2023 H6090A / S1035A; amended 2025 H5794B / S1086A', effective: '2024-01-01 (amended 2025-06-27)',
    summary: 'Converting a commercial building (offices, schools, religious facilities, medical buildings, malls) to at least 50% residential is a permitted use. In-footprint projects with sewer and water cannot be limited below 15 units/acre and must include 20% low-and-moderate-income units.',
    relevance: (p) => p.construction_kind === 'conversion' ? 'Your conversion project may qualify as adaptive reuse — a permitted use with minimum density protections.' : null,
  },
  {
    code: 'substandard_lots', name: 'Substandard lots of record',
    statute: 'RIGL 45-24-38', bill: 'Amended 2023, 2024, 2025, 2026', effective: 'multiple',
    summary: 'An owner does not need relief solely because a lot is below the district minimum size, and merger is not required when the lot is at least 50% of the size of nearby lots. This section changed four times in four years — quote the current text.',
    relevance: () => 'If the lot is smaller than the district minimum, relief may not be needed — check the current statute text.',
  },
  {
    code: 'inclusionary', name: 'Inclusionary zoning floor and bonus',
    statute: 'RIGL 45-24-46.1', bill: '2024 H7948A / S2999A (amended 2025)', effective: '2025-01-01',
    summary: 'Where inclusionary zoning applies: 15% minimum affordable share with a density bonus of one market-rate unit per affordable unit.',
    relevance: (p) => p.units >= 4 ? 'If the town has inclusionary zoning, the 15% affordable share comes with a matching density bonus.' : null,
  },
  {
    code: 'transit_parking', name: 'Parking caps near transit',
    statute: 'RIGL 45-24-33', bill: '2026 H8005A / S3303', effective: '2026-06-23',
    summary: 'Towns may require at most one off-street space per unit for multifamily housing within 1/4 mile of a regional mobility hub or 1/8 mile of a frequent transit stop.',
    relevance: (p) => p.units >= 2 ? 'If the site is near frequent transit, the town cannot require more than one parking space per unit.' : null,
  },
  {
    code: 'unified_review', name: 'Unified development review',
    statute: 'RIGL 45-23-50.1, 45-24-46.4', bill: '2023 H6061A / S1034A (amended 2024–2026)', effective: '2024-01-01',
    summary: 'When a project in development review also needs a variance or special use permit, the planning board decides the relief in the same process.',
    relevance: () => 'If your project needs dimensional relief, it is decided by the planning board within development review — not a separate zoning board case.',
  },
  {
    code: 'zoning_certificate', name: 'Zoning certificates within 20 days',
    statute: 'RIGL 45-24-54', bill: '2025', effective: '2025',
    summary: 'The town must issue a zoning certificate within 20 days of a written request; the determination is appealable to the zoning board.',
    relevance: () => 'You can request a zoning certificate to get the town\u2019s written answer on this lot\u2019s district and allowed use within 20 days.',
  },
];

export const REFORMS_SOURCE = {
  title: 'RI Enacted Land Use Law Amendments 2022–2026 (Statewide Planning Technical Paper 173)',
  url: 'https://planning.ri.gov/planning-areas/land-use',
  date: '2026-08-26',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'pt', name: 'Português (Portuguese)' },
  { code: 'kea', name: 'Kriolu (Cape Verdean Creole)' },
  { code: 'ht', name: 'Kreyòl Ayisyen (Haitian Creole)' },
  { code: 'km', name: 'ខ្មែរ (Khmer)' },
];
