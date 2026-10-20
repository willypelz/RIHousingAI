<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';

const sources = ref<any[]>([]);
const agencies = ref<any[]>([]);

onMounted(async () => {
  const [s, a] = await Promise.all([api.get('/sources'), api.get('/sources/agencies')]);
  sources.value = s.sources; agencies.value = a.agencies;
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="page-title">Official Sources & Agencies</h1>
    <p class="text-sm text-slate-500">
      Verified procedural sources used to generate checklists and assistant answers. Always re-verify requirements, fees, and dates directly with the authority before relying on them.
    </p>

    <div class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Agencies & contacts</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="a in agencies" :key="a.id" class="rounded-md border border-slate-100 p-3">
          <p class="text-sm font-medium text-slate-700">{{ a.name }}<span v-if="a.department"> — {{ a.department }}</span></p>
          <p class="text-xs text-slate-500">
            <span class="badge bg-slate-100 text-slate-600">{{ a.level }}</span>
            <span v-if="a.municipality_name"> · {{ a.municipality_name }}</span>
          </p>
          <p class="mt-1 text-xs text-slate-500">
            <span v-if="a.phone">{{ a.phone }} · </span>
            <span v-if="a.address">{{ a.address }} · </span>
            <a v-if="a.website" :href="a.website" target="_blank" class="link">website ↗</a>
          </p>
        </div>
      </div>
    </div>

    <div v-for="s in sources" :key="s.id" class="card">
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="font-semibold text-slate-800">{{ s.title }}</h2>
        <span class="badge bg-slate-100 text-slate-600">{{ s.agency_level || 'official' }}</span>
      </div>
      <p class="text-xs text-slate-500">{{ s.authority }}</p>
      <p class="mt-1 text-sm text-slate-600">{{ s.summary }}</p>
      <p class="mt-2 text-xs text-slate-500">
        <a :href="s.url" target="_blank" class="link">{{ s.url }} ↗</a>
        · Version: {{ s.doc_version || 'n/a' }}
        · Last verified: {{ s.last_verified_at?.slice(0, 10) || 'unverified' }}
      </p>
      <p v-if="s.fees_note" class="mt-1 text-xs text-amber-700">Fees: {{ s.fees_note }}</p>
      <p v-if="s.processing_estimate" class="mt-1 text-xs text-slate-500">Published processing estimate: {{ s.processing_estimate }}</p>
      <div v-if="s.change_history?.length" class="mt-2 text-xs text-slate-500">
        <p class="font-semibold">Change history:</p>
        <p v-for="(ch, i) in s.change_history" :key="i">{{ new Date(ch.changed_at).toLocaleDateString() }} — {{ ch.change_note }}</p>
      </div>
    </div>
  </div>
</template>
