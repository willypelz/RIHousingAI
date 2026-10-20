<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import AppIcon from '../components/AppIcon.vue';

const sources = ref<any[]>([]);
const agencies = ref<any[]>([]);
const townLinks = ref<any>(null);
const municipalities = ref<any[]>([]);
const selected = ref<string>(''); // '' = statewide only

onMounted(async () => {
  const [s, a, t, m] = await Promise.all([
    api.get('/sources'), api.get('/sources/agencies'), api.get('/sources/town-links'), api.get('/municipalities'),
  ]);
  sources.value = s.sources; agencies.value = a.agencies; townLinks.value = t;
  municipalities.value = m.municipalities;
});

const selectedTown = computed(() => municipalities.value.find(m => String(m.id) === selected.value));
const townLink = computed(() =>
  selectedTown.value ? townLinks.value?.towns.find((t: any) => t.name === selectedTown.value.name) : null);

const visibleSources = computed(() =>
  sources.value.filter(s => s.municipality_id == null || String(s.municipality_id) === selected.value));
const localSourceCount = computed(() =>
  selected.value ? sources.value.filter(s => String(s.municipality_id) === selected.value).length : 0);
const visibleAgencies = computed(() =>
  agencies.value.filter(a => a.municipality_id == null || String(a.municipality_id) === selected.value));
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="page-title">Official Sources</h1>
        <p class="mt-1.5 text-[15px] text-slate-500">Statewide frameworks plus verified local procedures — filtered by location.</p>
      </div>
      <div class="w-full sm:w-64">
        <label class="label" for="src-muni">Municipality</label>
        <select id="src-muni" v-model="selected" class="input">
          <option value="">Statewide only</option>
          <option v-for="m in municipalities" :key="m.id" :value="String(m.id)">
            {{ m.name }}{{ m.coverage_status !== 'planned' ? ' (verified local data)' : '' }}
          </option>
        </select>
      </div>
    </div>

    <!-- Town quick links: works for every municipality, even without curated sources -->
    <div v-if="selectedTown && townLinks" class="card !p-5">
      <h2 class="text-[15px] font-bold text-slate-900">{{ selectedTown.name }} — where the local rules live</h2>
      <p v-if="!localSourceCount" class="mt-1 text-xs text-amber-700">
        Local procedural sources for {{ selectedTown.name }} aren't verified on this platform yet — statewide sources below still apply. Use these official links and confirm details with the town.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <a v-if="townLink" :href="townLink.url" target="_blank"
          class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700">
          <AppIcon name="document" :size="13" /> Zoning ordinance ({{ townLink.platform }}{{ townLink.where ? ' — ' + townLink.where : '' }}) <AppIcon name="external" :size="11" class="text-slate-400" />
        </a>
        <a v-for="t in townLinks.map_tools" :key="t.url" :href="t.url" target="_blank"
          class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700">
          <AppIcon name="map" :size="13" /> {{ t.name }} <AppIcon name="external" :size="11" class="text-slate-400" />
        </a>
      </div>
      <p class="hint mt-2">Links checked {{ townLinks.links_checked }} (Statewide Planning TP172).</p>
    </div>

    <!-- Agencies -->
    <div class="card !p-5">
      <h2 class="mb-3 text-[15px] font-bold text-slate-900">Agencies & contacts
        <span class="ml-1 text-xs font-normal text-slate-400">{{ selected ? 'statewide + ' + (selectedTown?.name ?? '') : 'statewide' }}</span>
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="a in visibleAgencies" :key="a.id" class="rounded-lg border border-slate-200 p-3">
          <p class="text-sm font-semibold text-slate-800">{{ a.name }}<span v-if="a.department" class="font-normal text-slate-500"> — {{ a.department }}</span></p>
          <p class="mt-0.5 text-xs text-slate-500">
            <span class="badge bg-slate-100 text-slate-600">{{ a.level }}</span>
            <span v-if="a.municipality_name" class="badge ml-1 bg-brand-50 text-brand-700">{{ a.municipality_name }}</span>
          </p>
          <p class="mt-1.5 text-xs text-slate-500">
            <span v-if="a.phone">{{ a.phone }} · </span>
            <a v-if="a.website" :href="a.website" target="_blank" class="link">website</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Sources -->
    <div v-for="s in visibleSources" :key="s.id" class="card !p-5">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="text-[15px] font-bold text-slate-900">{{ s.title }}</h2>
        <span class="badge" :class="s.municipality_name ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'">
          {{ s.municipality_name ?? 'statewide' }}
        </span>
      </div>
      <p class="text-xs text-slate-500">{{ s.authority }}</p>
      <p class="mt-1.5 text-sm leading-relaxed text-slate-600">{{ s.summary }}</p>
      <p class="mt-2 text-xs text-slate-400">
        <a :href="s.url" target="_blank" class="link">{{ s.url }}</a>
        · Version: {{ s.doc_version || 'n/a' }}
        · Last verified: {{ s.last_verified_at?.slice(0, 10) || 'unverified' }}
      </p>
      <p v-if="s.fees_note" class="mt-1 text-xs text-amber-700">Fees: {{ s.fees_note }}</p>
      <p v-if="s.processing_estimate" class="mt-1 text-xs text-slate-500">Published processing estimate: {{ s.processing_estimate }}</p>
      <div v-if="s.change_history?.length" class="mt-2 text-xs text-slate-400">
        <p class="font-semibold">Change history:</p>
        <p v-for="(ch, i) in s.change_history" :key="i">{{ new Date(ch.changed_at).toLocaleDateString() }} — {{ ch.change_note }}</p>
      </div>
    </div>
    <div v-if="!sources.length" class="space-y-3" aria-busy="true"><div v-for="i in 3" :key="i" class="skeleton h-28"></div></div>
  </div>
</template>
