<script setup lang="ts">
import { ref, computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ events: any[]; today: string }>();

const TYPE_CLS: Record<string, string> = {
  created: 'bg-slate-200 text-slate-700',
  submitted: 'bg-brand-100 text-brand-800',
  due: 'bg-amber-100 text-amber-800',
  decision: 'bg-violet-100 text-violet-800',
  inspection: 'bg-cyan-100 text-cyan-800',
  task: 'bg-rose-100 text-rose-700',
  checklist: 'bg-sky-100 text-sky-800',
};

const cursor = ref(new Date(props.today + 'T12:00:00'));
const monthLabel = computed(() => cursor.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

function move(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 15);
}

const weeks = computed(() => {
  const y = cursor.value.getFullYear();
  const m = cursor.value.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back to Sunday
  const days: { date: string; inMonth: boolean; events: any[] }[] = [];
  const d = new Date(start);
  for (let i = 0; i < 42; i++) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: iso, inMonth: d.getMonth() === m, events: props.events.filter(e => e.date === iso) });
    d.setDate(d.getDate() + 1);
  }
  const out = [];
  for (let i = 0; i < 6; i++) out.push(days.slice(i * 7, i * 7 + 7));
  // drop trailing weeks fully outside the month
  return out.filter(w => w.some(x => x.inMonth));
});

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<template>
  <div class="card !p-4 sm:!p-6">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-[1.05rem] font-bold text-slate-900">{{ monthLabel }}</h3>
      <div class="flex gap-1">
        <button class="btn-secondary !px-2.5 !py-1.5" @click="move(-1)" aria-label="Previous month"><AppIcon name="arrow-right" :size="14" class="rotate-180" /></button>
        <button class="btn-secondary !px-3 !py-1.5 text-xs" @click="cursor = new Date(today + 'T12:00:00')">Today</button>
        <button class="btn-secondary !px-2.5 !py-1.5" @click="move(1)" aria-label="Next month"><AppIcon name="arrow-right" :size="14" /></button>
      </div>
    </div>
    <div class="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200/70 ring-1 ring-slate-200/70 text-center">
      <div v-for="d in DOW" :key="d" class="bg-slate-50 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ d }}</div>
      <template v-for="(week, wi) in weeks" :key="wi">
        <div v-for="day in week" :key="day.date"
          class="min-h-16 bg-white p-1 text-left align-top sm:min-h-20"
          :class="{ '!bg-slate-50/80': !day.inMonth }">
          <span class="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold"
            :class="day.date === today ? 'bg-brand-600 text-white' : day.inMonth ? 'text-slate-600' : 'text-slate-300'">
            {{ Number(day.date.slice(8)) }}
          </span>
          <div v-for="(e, i) in day.events.slice(0, 2)" :key="i"
            class="mt-0.5 truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight"
            :class="e.missed ? 'bg-rose-200 text-rose-900' : TYPE_CLS[e.type]"
            :title="`${e.title}${e.detail ? ' — ' + e.detail : ''}${e.missed ? ' (missed target)' : ''}`">
            {{ e.missed ? '⚑ ' : '' }}{{ e.title }}
          </div>
          <p v-if="day.events.length > 2" class="ml-1 text-[9px] font-semibold text-slate-400">+{{ day.events.length - 2 }} more</p>
        </div>
      </template>
    </div>
    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium text-slate-500">
      <span v-for="(cls, t) in TYPE_CLS" :key="t" class="inline-flex items-center gap-1">
        <span class="h-2 w-2 rounded-full" :class="cls.split(' ')[0]"></span>{{ t }}
      </span>
    </div>
  </div>
</template>
