<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';

const props = defineProps<{ projectId: number }>();
const items = ref<any[]>([]);

const grouped = computed(() => {
  const g: Record<string, any[]> = {};
  for (const i of items.value) (g[i.approval_name] ||= []).push(i);
  return g;
});

const TYPE_ICONS: Record<string, string> = {
  form: '📄', document: '📎', plan: '📐', certification: '✍️', fee: '💲',
  instruction: 'ℹ️', prerequisite: '🔗', referral: '↪️', hearing: '🏛️',
};

async function load() { items.value = (await api.get(`/projects/${props.projectId}/checklist`)).items; }
async function setStatus(item: any, status: string) {
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { status });
  await load();
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
      Each item cites its official source. Fee amounts are never estimated by this platform — confirm current fees with the cited authority before submitting.
    </div>
    <div v-for="(group, approval) in grouped" :key="approval" class="card">
      <div class="mb-3">
        <h2 class="font-bold text-slate-900">{{ approval }}
          <span class="ml-2 text-xs font-normal text-slate-400">{{ group.filter(i => i.status === 'complete').length }}/{{ group.length }} complete</span>
        </h2>
        <div class="progress-track mt-2"><div class="progress-fill" :style="{ width: `${(group.filter(i => i.status === 'complete').length / group.length) * 100}%` }"></div></div>
      </div>
      <div v-for="item in group" :key="item.id" class="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0">
        <input type="checkbox" class="mt-1" :checked="item.status === 'complete'"
          @change="setStatus(item, ($event.target as HTMLInputElement).checked ? 'complete' : 'pending')" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium" :class="item.status === 'complete' ? 'text-slate-400 line-through' : 'text-slate-700'">
            {{ TYPE_ICONS[item.item_type] }} {{ item.title }}
          </p>
          <p class="text-xs text-slate-500">{{ item.description }}</p>
          <p class="mt-0.5 text-[11px] text-slate-400">
            Responsible: {{ item.responsible_authority }}
            <template v-if="item.source_url"> · <a :href="item.source_url" target="_blank" class="text-blue-600 hover:underline">source ↗</a> (verified {{ item.source_verified?.slice(0, 10) }})</template>
            <template v-if="item.submission_link"> · <a :href="item.submission_link" target="_blank" class="text-blue-600 hover:underline">submit ↗</a></template>
          </p>
          <p v-if="item.item_type === 'fee' && item.fee_note" class="text-[11px] text-amber-700">💲 {{ item.fee_note }}</p>
        </div>
        <select class="shrink-0 rounded border border-slate-200 p-1 text-[11px]" :value="item.status"
          @change="setStatus(item, ($event.target as HTMLSelectElement).value)">
          <option value="pending">pending</option><option value="in_progress">in progress</option>
          <option value="complete">complete</option><option value="not_applicable">n/a</option>
        </select>
      </div>
    </div>
  </div>
</template>
