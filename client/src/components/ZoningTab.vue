<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import { renderMarkdown } from '../lib/markdown';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number }>();
const emit = defineEmits<{ updated: [] }>();
const data = ref<any>(null);
const err = ref('');
const saving = ref(false);
const language = ref('en');
const translating = ref(false);
const translated = ref<Record<string, string>>({});
const summaries = ref<any[]>([]);
const generatingSummary = ref(false);

const district = ref('');
const districtFrom = ref('');
const checkValues = ref<Record<string, string>>({});
const sewer = ref('unknown');
const water = ref('unknown');
const regenerated = ref(false);

async function load() {
  const [z, s] = await Promise.all([
    api.get(`/projects/${props.projectId}/zoning`),
    api.get(`/projects/${props.projectId}/public-summaries`),
  ]);
  data.value = z;
  summaries.value = s.summaries;
  district.value = z.district ?? '';
  districtFrom.value = z.district_confirmed_from ?? '';
  sewer.value = z.sewer_service ?? 'unknown';
  water.value = z.water_service ?? 'unknown';
  for (const c of z.checks) checkValues.value[c.key] = c.value ?? '';
}

async function save() {
  saving.value = true; err.value = ''; regenerated.value = false;
  try {
    const res = await api.patch(`/projects/${props.projectId}/zoning`, {
      district: district.value, district_confirmed_from: districtFrom.value, checks: checkValues.value,
      sewer_service: sewer.value, water_service: water.value,
    });
    regenerated.value = res.pathway_regenerated;
    await load();
    emit('updated');
  } catch (e: any) { err.value = e.message; }
  finally { saving.value = false; }
}

/** Translatable strings of the zoning card (labels, notes — never names/links). */
const translatableTexts = computed(() => {
  if (!data.value) return [];
  const t: string[] = [data.value.disclaimer, data.value.ordinance?.note ?? '', data.value.reforms.note];
  for (const m of data.value.map_tools) t.push(m.note);
  for (const c of data.value.checks) { t.push(c.label); t.push(c.hint); }
  for (const r of data.value.reforms.items) { t.push(r.name); t.push(r.summary); if (r.relevance) t.push(r.relevance); }
  return t;
});

async function setLanguage(code: string) {
  language.value = code;
  translated.value = {};
  if (code === 'en' || !data.value) return;
  translating.value = true; err.value = '';
  try {
    const { translations } = await api.post(`/projects/${props.projectId}/zoning/translate`, {
      language: code, texts: translatableTexts.value,
    });
    const map: Record<string, string> = {};
    translatableTexts.value.forEach((orig: string, i: number) => { map[orig] = translations[i]; });
    translated.value = map;
  } catch (e: any) { err.value = e.message; }
  finally { translating.value = false; }
}

const tr = (text: string | null | undefined) => (text && translated.value[text]) || text || '';

async function generateSummary() {
  generatingSummary.value = true; err.value = '';
  try {
    await api.post(`/projects/${props.projectId}/public-summary`, { language: language.value });
    summaries.value = (await api.get(`/projects/${props.projectId}/public-summaries`)).summaries;
  } catch (e: any) { err.value = e.message; }
  finally { generatingSummary.value = false; }
}

function printSummary(s: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Project Summary</title><style>body{font-family:system-ui;max-width:700px;margin:3rem auto;line-height:1.7;padding:0 1rem}</style></head><body><div>${renderMarkdown(s.content)}</div><p style="color:#888;font-size:.8rem;margin-top:2rem">${s.notice}</p></body></html>`);
  w.document.close(); w.print();
}
onMounted(load);
</script>

<template>
  <div v-if="data" class="space-y-5">
    <!-- Language picker -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Language</span>
      <button v-for="l in data.languages" :key="l.code" @click="setLanguage(l.code)"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="language === l.code ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'">
        {{ l.name }}
      </button>
      <span v-if="translating" class="text-xs italic text-slate-500">Translating…</span>
    </div>
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>

    <p class="flex items-center gap-2 text-xs text-slate-500"><AppIcon name="info" :size="14" class="shrink-0 text-amber-500" /> {{ tr(data.disclaimer) }}</p>

    <!-- Step 1 · Utilities: drives the approval pathway -->
    <div class="card !ring-brand-500/25">
      <div class="mb-4 flex items-center gap-3">
        <span class="stat-icon bg-brand-700 text-white">1</span>
        <div>
          <h2 class="text-[1.05rem] font-bold text-slate-900">Confirm utilities</h2>
          <p class="text-xs text-slate-500">This generates your approval pathway. Ask the town DPW or your engineer.</p>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <div><label class="label" for="z-sewer">Sewer</label>
          <select id="z-sewer" v-model="sewer" class="input">
            <option value="unknown">Unknown</option>
            <option value="public_sewer">Public sewer</option>
            <option value="septic">Septic (OWTS)</option>
          </select></div>
        <div><label class="label" for="z-water">Water</label>
          <select id="z-water" v-model="water" class="input">
            <option value="unknown">Unknown</option>
            <option value="public_water">Public water</option>
            <option value="well">Well</option>
          </select></div>
        <div class="flex items-end"><button class="btn w-full" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save & build pathway' }}</button></div>
      </div>
      <p v-if="regenerated" class="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
        <AppIcon name="check" :size="14" /> Pathway updated — see the Workflow tab.</p>
    </div>

    <!-- Step 2 · District -->
    <div class="card">
      <div class="mb-4 flex items-center gap-3">
        <span class="stat-icon bg-slate-100 text-slate-600">2</span>
        <div>
          <h2 class="text-[1.05rem] font-bold text-slate-900">Find your district</h2>
          <p class="text-xs text-slate-500">Look it up, then record it here.</p>
        </div>
      </div>
      <div class="mb-4 flex flex-wrap gap-2">
        <a v-for="m in data.map_tools" :key="m.url" :href="m.url" target="_blank"
          class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700">
          <AppIcon name="map" :size="13" /> {{ m.name }} <AppIcon name="external" :size="11" class="text-slate-400" />
        </a>
        <a v-if="data.ordinance" :href="data.ordinance.url" target="_blank"
          class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700">
          <AppIcon name="document" :size="13" /> {{ data.municipality }} ordinance <AppIcon name="external" :size="11" class="text-slate-400" />
        </a>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label" for="z-district">District</label>
          <input id="z-district" v-model="district" class="input" placeholder="e.g. R-1" /></div>
        <div><label class="label" for="z-from">Confirmed from</label>
          <input id="z-from" v-model="districtFrom" class="input" placeholder="e.g. Town GIS map" /></div>
      </div>
    </div>

    <!-- Step 3 · Dimensional checks -->
    <div class="card">
      <div class="mb-4 flex items-center gap-3">
        <span class="stat-icon bg-slate-100 text-slate-600">3</span>
        <div>
          <h2 class="text-[1.05rem] font-bold text-slate-900">Record the rules for your district</h2>
          <p class="text-xs text-slate-500">From the ordinance's use & dimensional tables — <a v-if="data.ordinance" :href="data.ordinance.url" target="_blank" class="link">open it</a>. Values are never guessed.</p>
        </div>
      </div>
      <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div v-for="c in data.checks" :key="c.key" class="flex items-center gap-3 py-1">
          <label :for="`z-${c.key}`" class="w-40 shrink-0 text-sm font-medium text-slate-700" :title="tr(c.hint)">{{ tr(c.label) }}</label>
          <input :id="`z-${c.key}`" v-model="checkValues[c.key]" class="input" placeholder="—" />
        </div>
      </div>
      <button class="btn mt-4" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save zoning details' }}</button>
    </div>

    <!-- State reforms (collapsible) -->
    <div class="card">
      <h2 class="text-[1.05rem] font-bold text-slate-900">2024–2026 state reforms</h2>
      <p class="mb-3 mt-0.5 text-xs text-slate-500">{{ tr(data.reforms.note) }}
        <a :href="data.reforms.source.url" target="_blank" class="link">Source (TP173)</a></p>
      <details v-for="r in data.reforms.items" :key="r.code" class="group border-b border-slate-100 last:border-0">
        <summary class="flex cursor-pointer flex-wrap items-center gap-2 py-2.5 text-sm marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <AppIcon name="arrow-right" :size="12" class="text-slate-400 transition-transform group-open:rotate-90" />
          <span class="font-semibold text-slate-800">{{ tr(r.name) }}</span>
          <span v-if="r.relevance" class="badge bg-brand-50 text-brand-700">relevant to you</span>
          <span class="ml-auto hidden text-[11px] text-slate-400 sm:block">{{ r.statute }}</span>
        </summary>
        <div class="pb-3 pl-5">
          <p class="text-xs leading-relaxed text-slate-600">{{ tr(r.summary) }}</p>
          <p v-if="r.relevance" class="mt-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs text-brand-800">{{ tr(r.relevance) }}</p>
          <p class="mt-1.5 text-[11px] text-slate-400">{{ r.statute }} · {{ r.bill }} · effective {{ r.effective }}</p>
        </div>
      </details>
    </div>

    <!-- Public hearing summary -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-[1.05rem] font-bold text-slate-900">Summary for neighbors</h2>
          <p class="text-xs text-slate-500">Plain words, in the selected language. Review before sharing.</p>
        </div>
        <button class="btn" :disabled="generatingSummary" @click="generateSummary">
          <AppIcon v-if="!generatingSummary" name="sparkles" :size="14" /> {{ generatingSummary ? 'Writing…' : `Generate (${data.languages.find((l: any) => l.code === language)?.name})` }}
        </button>
      </div>
      <div v-for="s in summaries" :key="s.id" class="mt-4 rounded-lg border border-slate-200 p-3">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span class="badge bg-brand-50 text-brand-700">{{ s.language_name }}</span>
          <span>{{ new Date(s.created_at).toLocaleString() }}</span>
          <button class="link ml-auto inline-flex items-center gap-1" @click="printSummary(s)"><AppIcon name="printer" :size="13" /> Print</button>
        </div>
        <div class="space-y-1 text-sm leading-relaxed text-slate-700" v-html="renderMarkdown(s.content)"></div>
        <p class="mt-2 text-[11px] italic text-amber-700">{{ s.notice }}</p>
      </div>
    </div>
  </div>
  <div v-else class="space-y-4" aria-busy="true" aria-label="Loading zoning information">
    <div class="skeleton h-8 w-2/3"></div>
    <div class="card space-y-3"><div class="skeleton h-5 w-1/3"></div><div class="skeleton h-4 w-full"></div><div class="grid gap-3 sm:grid-cols-2"><div class="skeleton h-9"></div><div class="skeleton h-9"></div></div></div>
    <div class="card space-y-2"><div class="skeleton h-5 w-1/4"></div><div v-for="i in 4" :key="i" class="skeleton h-8 w-full"></div></div>
  </div>
</template>
