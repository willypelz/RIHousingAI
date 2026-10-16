<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';

const props = defineProps<{ projectId: number }>();
const checks = ref<any[]>([]);
const busy = ref(false);
const err = ref('');

const SEVERITY: Record<string, string> = {
  blocker: 'bg-red-100 text-red-800', warning: 'bg-amber-100 text-amber-800', info: 'bg-blue-100 text-blue-800',
};

async function load() { checks.value = (await api.get(`/projects/${props.projectId}/completeness-checks`)).checks; }
async function run() {
  busy.value = true; err.value = '';
  try { await api.post(`/projects/${props.projectId}/completeness-checks`); await load(); }
  catch (e: any) { err.value = e.message; }
  finally { busy.value = false; }
}
async function resolve(f: any) {
  await api.patch(`/projects/${props.projectId}/findings/${f.id}`, { resolved: !f.resolved });
  await load();
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-800">Application completeness check</h2>
        <p class="text-xs text-slate-500">Compares your uploads against the official checklist and scans extracted document text. Each finding shows its supporting evidence.</p>
      </div>
      <button class="btn" :disabled="busy" @click="run">{{ busy ? 'Analyzing…' : 'Run check' }}</button>
    </div>
    <p v-if="err" class="rounded bg-red-50 p-2 text-sm text-red-700">{{ err }}</p>

    <div v-for="check in checks" :key="check.id" class="card">
      <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span class="font-semibold text-slate-700">Check #{{ check.id }}</span>
        <span>{{ new Date(check.created_at).toLocaleString() }}</span>
        <span class="badge bg-slate-100 text-slate-600">engine: {{ check.engine }}</span>
        <span>{{ (check.findings || []).length }} finding(s)</span>
      </div>
      <p class="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">{{ check.disclaimer }}</p>
      <p v-if="!(check.findings || []).length" class="text-sm text-slate-500">
        No potential gaps detected by this automated check. This does not mean the application is officially complete.
      </p>
      <div v-for="f in check.findings || []" :key="f.id" class="border-b border-slate-100 py-2 last:border-0" :class="f.resolved ? 'opacity-50' : ''">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge" :class="SEVERITY[f.severity]">{{ f.severity }}</span>
          <span class="badge bg-slate-100 text-slate-600">{{ f.finding_type.replace(/_/g, ' ') }}</span>
          <p class="text-sm font-medium text-slate-700">{{ f.title }}</p>
          <button class="ml-auto text-xs text-blue-600 hover:underline" @click="resolve(f)">{{ f.resolved ? 'unresolve' : 'mark resolved' }}</button>
        </div>
        <p class="mt-1 text-xs text-slate-600">{{ f.detail }}</p>
        <p v-if="f.evidence" class="mt-1 rounded bg-slate-50 p-2 text-xs italic text-slate-500">Evidence: {{ f.evidence }}</p>
      </div>
    </div>
  </div>
</template>
