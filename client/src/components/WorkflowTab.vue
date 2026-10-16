<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';

const props = defineProps<{ projectId: number }>();
const pathway = ref<any>(null);
const progress = ref<any>(null);
const err = ref('');

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  active: 'bg-blue-100 text-blue-800',
  waiting_on_agency: 'bg-amber-100 text-amber-800',
  waiting_on_applicant: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  skipped: 'bg-slate-100 text-slate-400',
};
const STAGE_STATUSES = ['pending','active','waiting_on_agency','waiting_on_applicant','complete','skipped'];

async function load() {
  const [pw, pr] = await Promise.all([
    api.get(`/projects/${props.projectId}/pathway`),
    api.get(`/projects/${props.projectId}/progress`),
  ]);
  pathway.value = pw; progress.value = pr;
}

function stagesFor(paId: number) {
  return pathway.value.stages.filter((s: any) => s.project_approval_id === paId);
}
function depNames(stageId: number): string[] {
  const deps = pathway.value.dependencies.filter((d: any) => d.stage_id === stageId);
  return deps.map((d: any) => {
    const s = pathway.value.stages.find((x: any) => x.id === d.depends_on_stage_id);
    if (!s) return '';
    const pa = pathway.value.approvals.find((a: any) => a.id === s.project_approval_id);
    return `${s.name}${pa ? ` (${pa.name})` : ''}`;
  }).filter(Boolean);
}
async function setStatus(stage: any, status: string) {
  err.value = '';
  try {
    const body: any = { status };
    if (status === 'waiting_on_agency' && !stage.submitted_at) body.submitted_at = new Date().toISOString().slice(0, 10);
    await api.patch(`/projects/${props.projectId}/stages/${stage.id}`, body);
    await load();
  } catch (e: any) { err.value = e.message; }
}
onMounted(load);
</script>

<template>
  <div v-if="pathway && progress" class="space-y-6">
    <p v-if="err" class="rounded bg-red-50 p-2 text-sm text-red-700">{{ err }}</p>

    <!-- Summary -->
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card">
        <p class="section-title">Checklist</p>
        <p class="mt-1 text-xl font-extrabold text-slate-900">{{ progress.checklist.done }} <span class="text-sm font-medium text-slate-400">done</span> · {{ progress.checklist.outstanding }} <span class="text-sm font-medium text-slate-400">left</span></p>
        <div class="progress-track mt-2"><div class="progress-fill" :style="{ width: `${(Number(progress.checklist.done) / Math.max(1, Number(progress.checklist.done) + Number(progress.checklist.outstanding))) * 100}%` }"></div></div>
      </div>
      <div class="card"><p class="section-title">Open tasks</p>
        <p class="mt-1 text-xl font-extrabold text-slate-900">{{ progress.tasks.length }}</p></div>
      <div class="card"><p class="section-title">Potential bottlenecks</p>
        <p class="mt-1 text-xl font-extrabold" :class="progress.bottlenecks.length ? 'text-amber-600' : 'text-slate-900'">{{ progress.bottlenecks.length }}</p></div>
    </div>

    <div v-if="progress.bottlenecks.length" class="card border-amber-300 bg-amber-50">
      <h3 class="mb-2 text-sm font-semibold text-amber-900">Potential bottlenecks & recommended follow-up</h3>
      <div v-for="(b, i) in progress.bottlenecks" :key="i" class="text-sm text-amber-800">
        <strong>{{ b.stage }}</strong> ({{ b.approval }})<span v-if="b.days_elapsed != null"> — {{ b.days_elapsed }} days since submission</span>: {{ b.recommendation }}
      </div>
    </div>

    <!-- Approvals with stages -->
    <div v-for="a in pathway.approvals.filter((x: any) => x.applicability !== 'not_applicable')" :key="a.id" class="card">
      <div class="mb-1 flex flex-wrap items-center gap-2">
        <h2 class="font-semibold text-slate-800">{{ a.name }}</h2>
        <span class="badge" :class="a.applicability === 'conditional' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'">{{ a.applicability }}</span>
      </div>
      <p class="text-xs text-slate-500">
        {{ a.agency_name }}<span v-if="a.agency_department"> — {{ a.agency_department }}</span>
        <span v-if="a.agency_phone"> · {{ a.agency_phone }}</span>
        <a v-if="a.agency_website" :href="a.agency_website" target="_blank" class="text-blue-600 hover:underline"> · agency site ↗</a>
      </p>
      <p v-if="a.applicability_note" class="mt-1 text-xs italic text-amber-700">{{ a.applicability_note }}</p>
      <p v-if="a.source_url" class="mt-1 text-xs text-slate-400">
        Source: <a :href="a.source_url" target="_blank" class="text-blue-600 hover:underline">{{ a.source_title }}</a>
        (verified {{ a.source_verified?.slice(0, 10) }})
      </p>
      <p v-if="a.processing_estimate" class="mt-1 text-xs text-slate-500">📋 Published estimate: {{ a.processing_estimate }}</p>

      <div class="mt-4 flex flex-wrap gap-2.5">
        <div v-for="s in stagesFor(a.id)" :key="s.id"
          class="w-56 rounded-xl border p-3 transition-all duration-150 hover:shadow-soft"
          :class="s.status === 'active' ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200' : s.status === 'complete' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'">
          <div class="flex items-start justify-between gap-1">
            <p class="text-xs font-semibold text-slate-700">{{ s.name }}</p>
            <span class="badge shrink-0" :class="STATUS_COLORS[s.status]">{{ s.status.replace(/_/g, ' ') }}</span>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">{{ s.responsible_authority }}</p>
          <p v-if="s.submitted_at" class="text-[11px] text-slate-400">Submitted {{ s.submitted_at.slice(0, 10) }}</p>
          <p v-if="s.verified_due_date" class="text-[11px] text-red-500">Due {{ s.verified_due_date.slice(0, 10) }} (verified)</p>
          <p v-if="s.next_action" class="mt-1 text-[11px] italic text-blue-700">→ {{ s.next_action }}</p>
          <p v-if="depNames(s.id).length" class="mt-1 text-[11px] text-slate-400">Depends on: {{ depNames(s.id).join('; ') }}</p>
          <select class="mt-2 w-full rounded border border-slate-200 p-1 text-[11px]" :value="s.status"
            @change="setStatus(s, ($event.target as HTMLSelectElement).value)">
            <option v-for="st in STAGE_STATUSES" :key="st" :value="st">{{ st.replace(/_/g, ' ') }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Not applicable, for transparency -->
    <div class="card">
      <h3 class="mb-2 text-sm font-semibold text-slate-600">Determined not applicable to this project</h3>
      <div v-for="a in pathway.approvals.filter((x: any) => x.applicability === 'not_applicable')" :key="a.id" class="text-sm text-slate-500">
        <strong>{{ a.name }}</strong> — {{ a.applicability_note }}
      </div>
      <p v-if="!pathway.approvals.some((x: any) => x.applicability === 'not_applicable')" class="text-sm text-slate-400">None.</p>
    </div>
  </div>
  <p v-else class="text-slate-500">Loading workflow…</p>
</template>
