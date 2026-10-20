<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const ask = (q: string) => router.push({ path: '/assistant', query: { q } });

interface Faq { q: string; a: string; links?: { label: string; url: string }[] }
const GROUPS: { name: string; faqs: Faq[] }[] = [
  {
    name: 'Zoning — what can be built here?',
    faqs: [
      { q: 'How do I find my lot\u2019s zoning district?',
        a: 'Look the parcel up on the RI Zoning Atlas or your town\u2019s official GIS map, then confirm the rules in the town\u2019s zoning ordinance. The legal answer always comes from the town\u2019s official map and ordinance.',
        links: [{ label: 'RI Zoning Atlas', url: 'https://experience.arcgis.com/experience/e9b8450970b643ee9dd71188ce59e766/' }, { label: 'Official town maps', url: 'https://www.rigis.org/pages/municipal-gis-resources' }] },
      { q: 'How do I get the town\u2019s official written answer about my lot?',
        a: 'Request a zoning certificate. Under RIGL 45-24-54 the town must respond within 20 days of a written request, and the determination can be appealed to the zoning board.' },
      { q: 'Can I add an accessory dwelling unit (ADU)?',
        a: 'Since June 2024 (RIGL 45-24-73), one ADU per lot is allowed by right in three cases: as a family-disability accommodation on an owner-occupied property, on a residential lot of 20,000+ sq ft, or within the existing footprint of the home or an accessory structure. Those ADUs need only a building permit.' },
      { q: 'My lot is smaller than the district minimum. Do I need a variance?',
        a: 'Maybe not. RIGL 45-24-38 says an owner does not need relief solely because a lot of record is below the minimum size. This section has been amended four times since 2023 — confirm the current text before relying on it.' },
      { q: 'What changed in RI zoning law recently?',
        a: 'The 2024\u20132026 reforms include ADUs by right, townhouses as a permitted use in 2+ unit districts, required housing options in commercial districts, adaptive reuse of commercial buildings, parking caps near frequent transit, and unified development review. Each project\u2019s Zoning tab lists the reforms relevant to it.',
        links: [{ label: 'Statewide Planning \u2014 land use reforms (TP173)', url: 'https://planning.ri.gov/planning-areas/land-use' }] },
    ],
  },
  {
    name: 'Approvals — what does it take?',
    faqs: [
      { q: 'What approvals does a multi-unit residential project usually need?',
        a: 'Typically: land development review by the planning board (RIGL 45-23), a building permit under the State Building Code, fire plan review for 3+ unit buildings, sewer/water connection approvals (or a RIDEM septic permit if unsewered), possibly RIDEM stormwater coverage for 1+ acre of disturbance, then inspections and a Certificate of Occupancy. Register a project and the platform builds the pathway for your town.' },
      { q: 'What are the stages of land development review?',
        a: 'Major projects follow Master Plan, Preliminary Plan, and Final Plan stages, each with an administrative completeness check. Public notice and hearings apply at the master and preliminary stages. The administrative officer must certify completeness within statutory periods (e.g., 25 days at master plan).' },
      { q: 'Who decides variances for my development project?',
        a: 'Under unified development review (RIGL 45-23-50.1), when a project in development review also needs a variance or special use permit, the planning board decides that relief in the same process — not a separate zoning board case.' },
      { q: 'How long will my approval take?',
        a: 'No one can promise a timeline. State law sets maximum review periods per stage (published statutory periods, not predictions). The Workflow tab shows published estimates where they exist and tracks your actual elapsed time.' },
      { q: 'How much are the application fees?',
        a: 'Fees are set by each town\u2019s fee schedule and change over time, so this platform never estimates them. Every fee item on your checklist links to the authority that publishes the current amount.' },
      { q: 'What happens at a public hearing?',
        a: 'The board hears the application, staff comments, and public comment; neighbors may attend and speak. The Zoning tab can generate a plain-language project summary for neighbors in six languages.' },
    ],
  },
  {
    name: 'Funding — how does it get paid for?',
    faqs: [
      { q: 'What funding exists for affordable housing in RI?',
        a: 'The main sources are federal Low-Income Housing Tax Credits (9% competitive and 4% with bonds), the RI state housing tax credit, the Housing Production Fund, federal HOME and Housing Trust Fund dollars, state housing bond rounds, CDBG, and FHLBank Boston\u2019s AHP. Most projects combine several — see the Funding tab for source links and a gap calculator.',
        links: [{ label: 'RIHousing developer programs', url: 'https://www.rihousing.com/developers/' }] },
      { q: 'When are the funding deadlines?',
        a: 'Award cycles change each round, so check each program\u2019s source page or contact the program officer. The platform marks every deadline "check the source" rather than guessing.' },
    ],
  },
  {
    name: 'About this platform',
    faqs: [
      { q: 'Does RIHousingAI decide if my project is approved or what I can build?',
        a: 'No. It navigates official sources: it never makes zoning determinations, approval decisions, or funding award estimates. Only the responsible authorities decide — the platform tells you who they are and what they require.' },
      { q: 'Where does the information come from?',
        a: 'A curated registry of official sources — town pages, state statutes, Statewide Planning technical papers, the RI Zoning Atlas, and RIHousing — each with a last-verified date and change history. Always re-confirm with the authority before relying on a detail.' },
    ],
  },
];
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">Help & FAQs</h1>
      <p class="mt-1.5 text-[15px] text-slate-500">Common questions about zoning, approvals, and funding in Rhode Island — with official sources. For your specific project, ask the AI assistant.</p>
    </div>

    <section v-for="g in GROUPS" :key="g.name" class="card !p-5" :aria-label="g.name">
      <h2 class="mb-1 text-[15px] font-bold text-slate-900">{{ g.name }}</h2>
      <details v-for="f in g.faqs" :key="f.q" class="group border-b border-slate-100 last:border-0">
        <summary class="flex cursor-pointer items-start gap-2 py-3 text-sm font-medium text-slate-800 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <AppIcon name="arrow-right" :size="12" class="mt-1 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
          {{ f.q }}
        </summary>
        <div class="pb-3 pl-5">
          <p class="text-sm leading-relaxed text-slate-600">{{ f.a }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <a v-for="l in f.links || []" :key="l.url" :href="l.url" target="_blank" class="link inline-flex items-center gap-1 text-xs">
              {{ l.label }} <AppIcon name="external" :size="11" />
            </a>
            <button class="link inline-flex items-center gap-1 text-xs" @click="ask(f.q)">
              <AppIcon name="sparkles" :size="12" /> Ask the assistant about this
            </button>
          </div>
        </div>
      </details>
    </section>

    <p class="hint">Answers summarize official sources and may lag recent changes — confirm with the responsible authority. Statute references: RIGL 45-23 (development review), 45-24 (zoning), 45-24-73 (ADUs), 45-24-54 (zoning certificates).</p>
  </div>
</template>
