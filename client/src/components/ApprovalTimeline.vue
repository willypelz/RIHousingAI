<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ events: any[]; today: string }>();

const STYLE: Record<string, { icon: string; cls: string }> = {
  created: { icon: 'building', cls: 'bg-slate-200 text-slate-600' },
  submitted: { icon: 'upload', cls: 'bg-brand-100 text-brand-700' },
  due: { icon: 'bell', cls: 'bg-amber-100 text-amber-700' },
  decision: { icon: 'scale', cls: 'bg-violet-100 text-violet-700' },
  inspection: { icon: 'clipboard', cls: 'bg-cyan-100 text-cyan-700' },
  task: { icon: 'check', cls: 'bg-rose-100 text-rose-600' },
};

const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const upcomingIdx = computed(() => props.events.findIndex(e => e.date > props.today));
</script>

<template>
  <div class="card">
    <p v-if="!events.length" class="py-6 text-center text-sm text-slate-500">
      No dated events yet. Dates appear here as you record submissions, decisions, inspections, and verified deadlines.
    </p>
    <ol v-else class="relative ml-2 border-l-2 border-slate-200">
      <template v-for="(e, i) in events" :key="i">
        <li v-if="i === upcomingIdx" class="relative mb-1 pb-1 pl-7" aria-hidden="true">
          <span class="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-brand-100"></span>
          <span class="text-[10px] font-bold uppercase tracking-widest text-brand-600">Today · {{ fmt(today) }}</span>
        </li>
        <li class="relative pb-5 pl-7 last:pb-1" :class="e.date <= today ? '' : 'opacity-90'">
          <span class="absolute -left-[13px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white"
            :class="STYLE[e.type]?.cls || STYLE.created.cls">
            <AppIcon :name="STYLE[e.type]?.icon || 'info'" :size="12" />
          </span>
          <div class="flex flex-wrap items-baseline gap-x-2">
            <time class="text-xs font-semibold" :class="e.date > today ? 'text-brand-600' : 'text-slate-400'" :datetime="e.date">{{ fmt(e.date) }}</time>
            <span class="text-sm font-semibold text-slate-800">{{ e.title }}</span>
          </div>
          <p v-if="e.detail" class="mt-0.5 text-xs text-slate-500">{{ e.detail }}</p>
        </li>
      </template>
      <li v-if="upcomingIdx === -1" class="relative pl-7" aria-hidden="true">
        <span class="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-brand-500 ring-4 ring-brand-100"></span>
        <span class="text-[10px] font-bold uppercase tracking-widest text-brand-600">Today · {{ fmt(today) }}</span>
      </li>
    </ol>
  </div>
</template>
