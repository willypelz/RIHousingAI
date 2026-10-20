<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import { renderMarkdown } from '../lib/markdown';

const props = defineProps<{ projectId: number }>();
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
  } catch (e: any) { err.value = e.message; }
  finally { saving.value = false; }
}

/** Translatable strings of the zoning card (labels, notes — never names/links). */
const translatableTexts = computed(() => {
  if (!data.value) return [];
  const t: string[] = [data.value.disclaimer, data.value.ordinance?.note ?? '', data.value.reforms.note];
  for (const m of data.value.map_tools) t.push(m.note);
  for (const c of data.value.checks) { t.push(c.label); t.push(c.hint); }
  for (const r of data.value.reforms.items) { t.push(r.summary); if (r.relevance) t.push(r.relevance); }
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
      <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Language</span>
      <button v-for="l in data.languages" :key="l.code" @click="setLanguage(l.code)"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="language === l.code ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'">
        {{ l.name }}
      </button>
      <span v-if="translating" class="text-xs italic text-slate-400">Translating…</span>
    </div>
    <p v-if="err" class="rounded bg-rose-50 p-2 text-sm text-rose-700">{{ err }}</p>

    <div class="rounded-md bg-amber-50 p-3 text-xs text-amber-800">{{ tr(data.disclaimer) }}</div>

    <!-- Zoning district card -->
    <div class="card">
      <h2 class="mb-1 font-bold text-slate-900">Zoning district — {{ data.municipality }}</h2>
      <p v-if="data.ordinance" class="text-xs text-slate-500">
        {{ tr(data.ordinance.note) }}
        <a :href="data.ordinance.url" target="_blank" class="font-medium text-brand-600 underline">Open the {{ data.municipality }} ordinance ↗</a>
        <span class="text-slate-400"> (links checked {{ data.links_checked }})</span>
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div><label class="label">District (from the official map)</label>
          <input v-model="district" class="input" placeholder="e.g. R-1, A-2 — find it with the map tools below" /></div>
        <div><label class="label">Where you confirmed it</label>
          <input v-model="districtFrom" class="input" placeholder="e.g. Town GIS map, zoning certificate" /></div>
      </div>
      <div class="mt-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Find the district</p>
        <div v-for="m in data.map_tools" :key="m.url" class="mb-1.5 text-sm">
          <a :href="m.url" target="_blank" class="font-medium text-brand-600 underline">{{ m.name }} ↗</a>
          <span class="text-xs text-slate-500"> — {{ tr(m.note) }}</span>
        </div>
      </div>
    </div>

    <!-- Utilities confirmation: drives the approval pathway -->
    <div class="card border-brand-200">
      <h2 class="mb-1 font-bold text-slate-900">Utilities for this lot</h2>
      <p class="mb-3 text-xs text-slate-500">Confirm with the town (DPW / water department) or your engineer. Saving updates the approval pathway — e.g. public sewer removes the RIDEM septic permit, septic adds it.</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label">Sewer service</label>
          <select v-model="sewer" class="input">
            <option value="unknown">Unknown — needs confirmation</option>
            <option value="public_sewer">Public sewer</option>
            <option value="septic">Septic (OWTS)</option>
          </select></div>
        <div><label class="label">Water service</label>
          <select v-model="water" class="input">
            <option value="unknown">Unknown — needs confirmation</option>
            <option value="public_water">Public water</option>
            <option value="well">Well</option>
          </select></div>
      </div>
      <p v-if="regenerated" class="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">✓ Approval pathway regenerated from your zoning analysis — check the Workflow and Checklist tabs.</p>
    </div>

    <!-- What to check panel -->
    <div class="card">
      <h2 class="mb-1 font-bold text-slate-900">What to check for this lot</h2>
      <p class="mb-3 text-xs text-slate-500">Read these from the use table and dimensional table for your district in the ordinance. This platform records what you find — it never guesses values.</p>
      <div v-for="c in data.checks" :key="c.key" class="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2 last:border-0">
        <div class="min-w-48 flex-1">
          <p class="text-sm font-medium text-slate-700">{{ tr(c.label) }}</p>
          <p class="text-[11px] text-slate-400">{{ tr(c.hint) }}
            <a v-if="c.lookup_url" :href="c.lookup_url" target="_blank" class="text-brand-600 underline">find it ↗</a></p>
        </div>
        <input v-model="checkValues[c.key]" class="input w-full sm:w-56" placeholder="— not yet found —" />
      </div>
      <button class="btn mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save zoning details' }}</button>
    </div>

    <!-- State reforms -->
    <div class="card">
      <h2 class="mb-1 font-bold text-slate-900">RI housing reforms (2024–2026) that may change what this lot can hold</h2>
      <p class="mb-3 text-xs text-slate-500">{{ tr(data.reforms.note) }}
        Source: <a :href="data.reforms.source.url" target="_blank" class="text-brand-600 underline">{{ data.reforms.source.title }}</a> ({{ data.reforms.source.date }})</p>
      <div v-for="r in data.reforms.items" :key="r.code" class="border-b border-slate-100 py-2.5 last:border-0">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-semibold text-slate-800">{{ r.name }}</p>
          <span class="badge bg-slate-100 text-slate-600">{{ r.statute }}</span>
          <span class="badge bg-slate-100 text-slate-500">effective {{ r.effective }}</span>
        </div>
        <p class="mt-1 text-xs text-slate-600">{{ tr(r.summary) }}</p>
        <p v-if="r.relevance" class="mt-1 rounded bg-brand-50 px-2 py-1 text-xs text-brand-800">→ {{ tr(r.relevance) }}</p>
      </div>
    </div>

    <!-- Public hearing summary -->
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-bold text-slate-900">Plain-language summary for neighbors & the public hearing</h2>
          <p class="text-xs text-slate-500">Generated in the selected language, in words a non-expert can follow. Review before sharing.</p>
        </div>
        <button class="btn" :disabled="generatingSummary" @click="generateSummary">
          {{ generatingSummary ? 'Writing…' : `✨ Generate (${data.languages.find((l: any) => l.code === language)?.name})` }}
        </button>
      </div>
      <div v-for="s in summaries" :key="s.id" class="mt-4 rounded-lg border border-slate-200 p-3">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span class="badge bg-brand-50 text-brand-700">{{ s.language_name }}</span>
          <span>{{ new Date(s.created_at).toLocaleString() }}</span>
          <button class="ml-auto text-brand-600 underline" @click="printSummary(s)">🖨 Print</button>
        </div>
        <div class="space-y-1 text-sm leading-relaxed text-slate-700" v-html="renderMarkdown(s.content)"></div>
        <p class="mt-2 text-[11px] italic text-amber-700">{{ s.notice }}</p>
      </div>
    </div>
  </div>
  <p v-else class="text-slate-500">Loading zoning information…</p>
</template>
