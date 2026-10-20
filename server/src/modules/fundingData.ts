/** Rhode Island affordable-housing funding programs. Curated from official program pages
 *  (links checked Oct 2026). Amounts and deadlines are shown only as published descriptions —
 *  award cycles change, so anything not stated on the source page is "Check the source". */

export const FUNDING_LINKS_CHECKED = '2026-10-20';

export interface FundingProgram {
  code: string;
  name: string;
  administrator: string;
  url: string;
  summary: string;
  who_can_apply: string;
  amount_note: string;      // published description only — never a promised figure
  deadline_note: string;    // "Check the source" unless a standing cycle is published
  tags: string[];           // which project kinds it typically fits
}

export const FUNDING_PROGRAMS: FundingProgram[] = [
  {
    code: 'lihtc_9',
    name: 'Federal Low-Income Housing Tax Credit (9%)',
    administrator: 'RIHousing',
    url: 'https://www.rihousing.com/developers/',
    summary: 'The primary capital source for affordable rental production. Competitive 9% credits are awarded through RIHousing\u2019s Qualified Allocation Plan (QAP); investors buy the credits, providing equity.',
    who_can_apply: 'For-profit and nonprofit developers of qualified affordable rental housing (income- and rent-restricted units).',
    amount_note: 'Equity typically covers a substantial share of eligible development costs; per-project caps are set in the current QAP — check the source.',
    deadline_note: 'Awarded in competitive rounds announced by RIHousing — check the source for the current QAP cycle.',
    tags: ['rental', 'affordable'],
  },
  {
    code: 'lihtc_4',
    name: 'Federal LIHTC (4%) with tax-exempt bonds',
    administrator: 'RIHousing',
    url: 'https://www.rihousing.com/developers/',
    summary: 'Non-competitive 4% credits paired with tax-exempt bond financing, generally for larger rental projects that meet the 50% bond-financing test.',
    who_can_apply: 'Developers of qualified affordable rental projects financed with tax-exempt bonds.',
    amount_note: 'Depends on eligible basis and bond structure — check the source.',
    deadline_note: 'Generally available year-round subject to bond volume cap — check the source.',
    tags: ['rental', 'affordable', 'large'],
  },
  {
    code: 'ri_state_lihtc',
    name: 'Rhode Island State Low-Income Housing Tax Credit',
    administrator: 'RIHousing (RIGL 44-71)',
    url: 'https://www.rihousing.com/developers/',
    summary: 'State tax credit (enacted 2023) that can pair with federal LIHTC to deepen equity in qualified projects.',
    who_can_apply: 'Developers of qualified low-income housing approved by RIHousing.',
    amount_note: 'Program-wide annual cap set by statute; per-project amounts set at award — check the source.',
    deadline_note: 'Allocated alongside RIHousing funding rounds — check the source.',
    tags: ['rental', 'affordable'],
  },
  {
    code: 'hpf',
    name: 'Housing Production Fund',
    administrator: 'RIHousing',
    url: 'https://www.rihousing.com/developers/',
    summary: 'State-funded gap financing for the production of deeply affordable rental homes, created from 2021 state budget appropriations and expanded since.',
    who_can_apply: 'Developers producing units affordable at low income levels (typically 30% AMI tiers feature prominently).',
    amount_note: 'Gap subsidy sized per project at award — check the source.',
    deadline_note: 'Competitive rounds announced by RIHousing — check the source.',
    tags: ['rental', 'affordable'],
  },
  {
    code: 'home',
    name: 'HOME Investment Partnerships',
    administrator: 'RIHousing (federal HUD funds)',
    url: 'https://www.rihousing.com/developers/',
    summary: 'Federal funds for building, buying, or rehabilitating affordable housing for rent or ownership.',
    who_can_apply: 'Developers including CHDOs (community housing development organizations); projects must meet HOME income and rent limits.',
    amount_note: 'Per-unit subsidy limits set by HUD and program rules — check the source.',
    deadline_note: 'Application rounds announced by RIHousing — check the source.',
    tags: ['rental', 'ownership', 'affordable'],
  },
  {
    code: 'htf',
    name: 'National Housing Trust Fund',
    administrator: 'RIHousing (federal HUD funds)',
    url: 'https://www.rihousing.com/developers/',
    summary: 'Federal funds targeted to extremely low-income households (30% AMI), usually layered into rental projects.',
    who_can_apply: 'Developers of rental housing serving extremely low-income tenants.',
    amount_note: 'Sized per project at award — check the source.',
    deadline_note: 'Combined with RIHousing rental funding rounds — check the source.',
    tags: ['rental', 'affordable'],
  },
  {
    code: 'bhri_bond',
    name: 'Building Homes Rhode Island (housing bond)',
    administrator: 'RIHousing / RI Housing Resources Commission',
    url: 'https://www.rihousing.com/developers/',
    summary: 'Voter-approved state bond funds for affordable housing production, deployed in periodic rounds.',
    who_can_apply: 'Developers of eligible affordable housing (rental and homeownership).',
    amount_note: 'Per-project awards set each round — check the source.',
    deadline_note: 'Round schedules announced by the administrator — check the source.',
    tags: ['rental', 'ownership', 'affordable'],
  },
  {
    code: 'cdbg',
    name: 'Community Development Block Grant (CDBG)',
    administrator: 'RI Office of Housing and Community Development (and entitlement cities)',
    url: 'https://ohcd.ri.gov/',
    summary: 'Federal community development funds that can support housing activities, infrastructure, and site work benefiting low/moderate-income residents. Providence, Pawtucket, Woonsocket, East Providence and Cranston run their own entitlement programs.',
    who_can_apply: 'Municipalities apply; developers partner with the municipality. Entitlement cities accept proposals directly.',
    amount_note: 'Varies by community allocation — check the source.',
    deadline_note: 'Annual cycles per community — check the source.',
    tags: ['rental', 'ownership', 'infrastructure'],
  },
  {
    code: 'fhlb_ahp',
    name: 'FHLBank Boston Affordable Housing Program (AHP)',
    administrator: 'Federal Home Loan Bank of Boston (via member banks)',
    url: 'https://www.fhlbboston.com/fhlbank-boston/ahp',
    summary: 'Competitive grants and subsidized loans for affordable rental and ownership housing, applied for through a member financial institution.',
    who_can_apply: 'Developers sponsored by an FHLBank Boston member bank.',
    amount_note: 'Per-project subsidy caps published in the current AHP Implementation Plan — check the source.',
    deadline_note: 'Typically one competitive round per year — check the source.',
    tags: ['rental', 'ownership', 'affordable'],
  },
  {
    code: 'federal_financing',
    name: 'RIHousing construction & permanent lending',
    administrator: 'RIHousing',
    url: 'https://www.rihousing.com/developers/',
    summary: 'Construction-to-permanent loans, taxable and tax-exempt, that anchor the debt portion of most affordable stacks.',
    who_can_apply: 'Developers with site control and a feasible affordable project.',
    amount_note: 'Underwritten per project — check the source.',
    deadline_note: 'Rolling — check the source.',
    tags: ['rental', 'debt'],
  },
];

export const FUNDING_DISCLAIMER = 'Program availability, amounts, and deadlines change with each funding round. Nothing here is an award estimate — confirm current terms on each program\u2019s source page or with the program officer. More than nine in ten subsidized projects need multiple sources; sequencing them is a strategic decision for your team.';
