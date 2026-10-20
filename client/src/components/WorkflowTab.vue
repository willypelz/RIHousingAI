<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';
import ApprovalTimeline from './ApprovalTimeline.vue';
import ApprovalCalendar from './ApprovalCalendar.vue';

const props = defineProps<{ projectId: number }>();
const pathway = ref<any>(null);
const progress = ref<any>(null);
const timeline = ref<any>(null);
const view = ref<'board' | 'timeline' | 'calendar'>('board');
const err = ref('');

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  active: 'bg-brand-100 text-brand-800',
  waiting_on_agency: 'bg-amber-100 text-amber-800',
  waiting_on_applicant: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  skipped: 'bg-slate-100 text-slate-500',
};
const STAGE_STATUSES = ['pending','active','waiting_on_agency','waiting_on_applicant','complete','skipped'];

async function load() {
  const [pw, pr, tl] = await Promise.all([
    api.get(`/projects/${props.projectId}/pathway`),
    api.get(`/projects/${props.projectId}/progress`),
    api.get(`/projects/${props.projectId}/timeline`),
  ]);
  pathway.value = pw; progress.value = pr; timeline.value = tl;
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
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>
    <div v-if="!pathway.approvals.length" class="card py-10 text-center">
      <h2 class="text-lg font-bold text-slate-800">No approval pathway yet</h2>
      <p class="mx-auto mt-1 max-w-md text-sm text-slate-500">Confirm the utilities for this lot in the Zoning tab — saving there generates the pathway from your project's details.</p>
    </div>

    <!-- KPI summary -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="stat-card">
        <span class="stat-icon bg-brand-50 text-brand-600"><AppIcon name="check" :size="20" /></span>
        <div class="min-w-0 flex-1">
          <p class="stat-value">{{ progress.checklist.done }}<span class="text-base font-semibold text-slate-400"> / {{ Number(progress.checklist.done) + Number(progress.checklist.outstanding) }}</span></p>
          <p class="stat-label">Checklist items complete</p>
          <div class="progress-track mt-2"><div class="progress-fill" :style="{ width: `${(Number(progress.checklist.done) / Math.max(1, Number(progress.checklist.done) + Number(progress.checklist.outstanding))) * 100}%` }"></div></div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon bg-violet-50 text-violet-600"><AppIcon name="clipboard" :size="20" /></span>
        <div><p class="stat-value">{{ progress.tasks.length }}</p><p class="stat-label">Open tasks</p></div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" :class="progress.bottlenecks.length ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'"><AppIcon name="info" :size="20" /></span>
        <div><p class="stat-value" :class="progress.bottlenecks.length ? 'text-amber-600' : ''">{{ progress.bottlenecks.length }}</p><p class="stat-label">Potential bottlenecks</p></div>
      </div>
    </div>

    <div v-if="progress.bottlenecks.length" class="card !bg-amber-50/70 !ring-amber-200">
      <h3 class="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900"><AppIcon name="info" :size="16" /> Potential bottlenecks & recommended follow-up</h3>
      <div v-for="(b, i) in progress.bottlenecks" :key="i" class="text-sm leading-relaxed text-amber-800">
        <strong>{{ b.stage }}</strong> ({{ b.approval }})<span v-if="b.days_elapsed != null"> — {{ b.days_elapsed }} days since submission</span>: {{ b.recommendation }}
      </div>
    </div>

    <!-- View switcher -->
    <div class="flex items-center justify-between gap-2">
      <div class="inline-flex gap-1 rounded-xl bg-slate-200/50 p-1 ring-1 ring-slate-900/[0.04]" role="tablist" aria-label="Workflow view">
        <button v-for="v in (['board','timeline','calendar'] as const)" :key="v" role="tab"
          :aria-selected="view === v" class="tab-btn !px-3 !py-1 capitalize" @click="view = v">{{ v }}</button>
      </div>
      <p class="hint hidden sm:block">Only recorded and verified dates appear — nothing is estimated.</p>
    </div>

    <ApprovalTimeline v-if="view === 'timeline' && timeline" :events="timeline.events" :today="timeline.today" />
    <ApprovalCalendar v-else-if="view === 'calendar' && timeline" :events="timeline.events" :today="timeline.today" />

    <!-- Approvals with stages (board) -->
    <template v-if="view === 'board'">
    <div v-for="a in pathway.approvals.filter((x: any) => x.applicability !== 'not_applicable')" :key="a.id" class="card">
      <div class="mb-1 flex flex-wrap items-center gap-2.5">
        <h2 class="text-[1.05rem] font-bold text-slate-900">{{ a.name }}</h2>
        <span class="badge" :class="a.applicability === 'conditional' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"><span class="badge-dot"></span>{{ a.applicability }}</span>
      </div>
      <p class="text-xs text-slate-500">
        {{ a.agency_name }}<span v-if="a.agency_department"> — {{ a.agency_department }}</span>
        <span v-if="a.agency_phone"> · {{ a.agency_phone }}</span>
        <a v-if="a.agency_website" :href="a.agency_website" target="_blank" class="link"> · agency site ↗</a>
      </p>
      <p v-if="a.applicability_note" class="mt-1 text-xs italic text-amber-700">{{ a.applicability_note }}</p>
      <p v-if="a.source_url" class="mt-1 text-xs text-slate-500">
        Source: <a :href="a.source_url" target="_blank" class="link">{{ a.source_title }}</a>
        (verified {{ a.source_verified?.slice(0, 10) }})
      </p>
      <p v-if="a.processing_estimate" class="mt-1 text-xs text-slate-500">Published estimate: {{ a.processing_estimate }}</p>

      <div class="mt-5 flex flex-wrap gap-3">
        <div v-for="s in stagesFor(a.id)" :key="s.id"
          class="w-full rounded-xl p-3.5 ring-1 transition-all duration-150 sm:w-56"
          :class="s.status === 'active' ? 'bg-brand-50/60 ring-brand-300' : s.status === 'complete' ? 'bg-emerald-50/50 ring-emerald-200' : 'bg-slate-50/60 ring-slate-200/80'">
          <div class="flex items-start justify-between gap-1">
            <p class="text-xs font-semibold text-slate-700">{{ s.name }}</p>
            <span class="badge shrink-0" :class="STATUS_COLORS[s.status]">{{ s.status.replace(/_/g, ' ') }}</span>
          </div>
          <p class="mt-1 text-[11px] text-slate-500">{{ s.responsible_authority }}</p>
          <p v-if="s.submitted_at" class="text-[11px] text-slate-500">Submitted {{ s.submitted_at.slice(0, 10) }}</p>
          <p v-if="s.verified_due_date" class="text-[11px] text-rose-600">Due {{ s.verified_due_date.slice(0, 10) }} (verified)</p>
          <p v-if="s.next_action" class="mt-1 text-[11px] italic text-brand-700">→ {{ s.next_action }}</p>
          <p v-if="depNames(s.id).length" class="mt-1 text-[11px] text-slate-500">Depends on: {{ depNames(s.id).join('; ') }}</p>
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
      <p v-if="!pathway.approvals.some((x: any) => x.applicability === 'not_applicable')" class="text-sm text-slate-500">None.</p>
    </div>
    </template>
  </div>
  <div v-else class="space-y-4" aria-busy="true" aria-label="Loading workflow">
    <div class="grid gap-3 sm:grid-cols-3"><div v-for="i in 3" :key="i" class="card space-y-2"><div class="skeleton h-3 w-1/2"></div><div class="skeleton h-6 w-2/3"></div></div></div>
    <div class="card space-y-3"><div class="skeleton h-5 w-1/3"></div><div class="flex flex-wrap gap-2.5"><div v-for="i in 4" :key="i" class="skeleton h-28 w-full sm:w-56"></div></div></div>
  </div>
</template>
