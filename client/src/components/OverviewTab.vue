<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number; project: any }>();
const emit = defineEmits<{ navigate: [tab: string] }>();

const progress = ref<any>(null);
const timeline = ref<any>(null);
const comments = ref<any[]>([]);
const checklist = ref<any[]>([]);

async function load() {
  const [pr, tl, cm, cl] = await Promise.all([
    api.get(`/projects/${props.projectId}/progress`),
    api.get(`/projects/${props.projectId}/timeline`),
    api.get(`/projects/${props.projectId}/comments`),
    api.get(`/projects/${props.projectId}/checklist`),
  ]);
  progress.value = pr; timeline.value = tl; comments.value = cm.comments; checklist.value = cl.items;
}

const utilitiesUnknown = computed(() =>
  props.project?.sewer_service === 'unknown' || props.project?.water_service === 'unknown');

const openFeedback = computed(() => comments.value.filter(c => c.status !== 'resolved'));
const openTasks = computed(() => (progress.value?.tasks ?? []).filter((t: any) => t.status === 'open'));
const activeStages = computed(() => progress.value?.waiting ?? []);
const checklistDone = computed(() => Number(progress.value?.checklist?.done ?? 0));
const checklistTotal = computed(() => checklistDone.value + Number(progress.value?.checklist?.outstanding ?? 0));
const nextItems = computed(() =>
  checklist.value.filter(i => !['complete', 'not_applicable'].includes(i.status)).slice(0, 4));
const recentEvents = computed(() => (timeline.value?.events ?? []).slice(-4).reverse());

const attentionCount = computed(() =>
  (utilitiesUnknown.value ? 1 : 0) + openFeedback.value.length + (progress.value?.bottlenecks?.length ?? 0) + openTasks.value.length);

async function completeItem(item: any) {
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { status: 'complete' });
  await load();
}
async function doneTask(t: any) {
  await api.patch(`/projects/${props.projectId}/tasks/${t.id}`, { status: 'done' });
  await load();
}

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const EVENT_ICON: Record<string, string> = { created: 'building', submitted: 'upload', due: 'bell', decision: 'scale', inspection: 'clipboard', task: 'check' };

onMounted(load);
</script>

<template>
  <div v-if="progress" class="space-y-5">
    <!-- Stats -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="stat-card">
        <span class="stat-icon bg-brand-50 text-brand-700"><AppIcon name="check" :size="18" /></span>
        <div class="min-w-0 flex-1">
          <p class="stat-value">{{ checklistDone }}<span class="text-sm font-medium text-slate-400"> / {{ checklistTotal }}</span></p>
          <p class="stat-label">Checklist complete</p>
          <div class="progress-track mt-1.5"><div class="progress-fill" :style="{ width: `${(checklistDone / Math.max(1, checklistTotal)) * 100}%` }"></div></div>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon bg-cyan-50 text-cyan-700"><AppIcon name="refresh" :size="18" /></span>
        <div><p class="stat-value">{{ activeStages.length }}</p><p class="stat-label">Active stages</p></div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" :class="openFeedback.length ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'"><AppIcon name="chat" :size="18" /></span>
        <div><p class="stat-value" :class="openFeedback.length ? 'text-amber-600' : ''">{{ openFeedback.length }}</p><p class="stat-label">Open feedback</p></div>
      </div>
      <div class="stat-card">
        <span class="stat-icon" :class="openTasks.length ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-500'"><AppIcon name="clipboard" :size="18" /></span>
        <div><p class="stat-value">{{ openTasks.length }}</p><p class="stat-label">Open tasks</p></div>
      </div>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- Needs attention -->
      <section class="card !p-5" aria-labelledby="ov-attention">
        <h2 id="ov-attention" class="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
          Needs your attention
          <span v-if="attentionCount" class="badge bg-amber-100 text-amber-800">{{ attentionCount }}</span>
        </h2>
        <div class="space-y-2.5">
          <button v-if="utilitiesUnknown" @click="emit('navigate', 'zoning')"
            class="flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-left transition-colors hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <AppIcon name="map" :size="16" class="shrink-0 text-amber-600" />
            <span class="flex-1 text-sm text-slate-700"><strong>Confirm utilities</strong> — several approvals stay conditional until sewer and water are confirmed.</span>
            <AppIcon name="arrow-right" :size="14" class="shrink-0 text-slate-400" />
          </button>
          <div v-for="(b, i) in progress.bottlenecks" :key="'b' + i" class="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <AppIcon name="bell" :size="16" class="mt-0.5 shrink-0 text-amber-600" />
            <p class="text-sm text-slate-700"><strong>{{ b.stage }}</strong> ({{ b.approval }})<span v-if="b.days_elapsed != null"> — {{ b.days_elapsed }} days</span>. <span class="text-slate-500">{{ b.recommendation }}</span></p>
          </div>
          <button v-for="c in openFeedback.slice(0, 3)" :key="'c' + c.id" @click="emit('navigate', 'checklist')"
            class="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <AppIcon name="chat" :size="16" class="mt-0.5 shrink-0" :class="c.comment_type === 'rai' ? 'text-rose-600' : 'text-slate-400'" />
            <span class="min-w-0 flex-1">
              <span class="badge mr-1.5" :class="c.comment_type === 'rai' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'">{{ c.comment_type }}</span>
              <span class="text-sm text-slate-700">{{ c.body.slice(0, 90) }}{{ c.body.length > 90 ? '…' : '' }}</span>
            </span>
            <AppIcon name="arrow-right" :size="14" class="mt-0.5 shrink-0 text-slate-400" />
          </button>
          <div v-for="t in openTasks.slice(0, 3)" :key="'t' + t.id" class="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <AppIcon name="clipboard" :size="16" class="shrink-0 text-violet-500" />
            <span class="min-w-0 flex-1 text-sm text-slate-700">{{ t.title }}
              <span class="badge ml-1.5" :class="t.waiting_on === 'agency' ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-700'">waiting on {{ t.waiting_on }}</span>
            </span>
            <button class="link shrink-0 text-xs" @click="doneTask(t)">mark done</button>
          </div>
          <p v-if="!attentionCount" class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800">
            <AppIcon name="check" :size="16" /> Nothing needs your attention right now.
          </p>
        </div>
      </section>

      <!-- What's next -->
      <section class="card !p-5" aria-labelledby="ov-next">
        <h2 id="ov-next" class="mb-3 text-[15px] font-bold text-slate-900">What's next</h2>
        <div class="space-y-2.5">
          <div v-for="s in activeStages.slice(0, 3)" :key="'s' + s.id" class="rounded-lg border border-slate-200 p-3">
            <p class="text-sm font-semibold text-slate-800">{{ s.name }} <span class="font-normal text-slate-400">· {{ s.approval_name }}</span></p>
            <p class="mt-0.5 text-xs text-slate-500">{{ s.responsible_authority }}<span v-if="s.days_elapsed != null"> · {{ s.days_elapsed }} days since submission</span></p>
          </div>
          <div v-for="i in nextItems" :key="'i' + i.id" class="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <button class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent transition-colors hover:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :aria-label="`Mark ${i.title} complete`" @click="completeItem(i)">
              <AppIcon name="check" :size="12" />
            </button>
            <span class="min-w-0 flex-1 truncate text-sm text-slate-700" :title="i.title">{{ i.title }}</span>
            <span class="hidden shrink-0 text-[11px] text-slate-400 sm:block">{{ i.approval_name }}</span>
          </div>
          <p v-if="!activeStages.length && !nextItems.length" class="hint p-1">All stages and checklist items are complete or not yet generated.</p>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="emit('navigate', 'checklist')"><AppIcon name="check" :size="13" /> Checklist</button>
          <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="emit('navigate', 'documents')"><AppIcon name="upload" :size="13" /> Upload docs</button>
          <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="emit('navigate', 'completeness')"><AppIcon name="sparkles" :size="13" /> Check completeness</button>
          <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="emit('navigate', 'funding')"><AppIcon name="currency" :size="13" /> Funding</button>
        </div>
      </section>
    </div>

    <!-- Recent activity -->
    <section class="card !p-5" aria-labelledby="ov-activity">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="ov-activity" class="text-[15px] font-bold text-slate-900">Recent activity</h2>
        <button class="link text-xs" @click="emit('navigate', 'workflow')">Full timeline</button>
      </div>
      <p v-if="!recentEvents.length" class="hint">No dated events yet — they appear as you record submissions, decisions, and inspections.</p>
      <div v-for="(e, i) in recentEvents" :key="i" class="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0 last:pb-0">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <AppIcon :name="EVENT_ICON[e.type] || 'info'" :size="13" />
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-slate-700">{{ e.title }}<span v-if="e.detail" class="text-slate-400"> · {{ e.detail }}</span></span>
        <time class="shrink-0 text-xs text-slate-400" :datetime="e.date">{{ fmt(e.date) }}</time>
      </div>
    </section>
  </div>

  <div v-else class="space-y-4" aria-busy="true" aria-label="Loading overview">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><div v-for="i in 4" :key="i" class="skeleton h-20"></div></div>
    <div class="grid gap-5 lg:grid-cols-2"><div class="skeleton h-64"></div><div class="skeleton h-64"></div></div>
  </div>
</template>
