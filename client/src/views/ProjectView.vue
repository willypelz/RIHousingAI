<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import WorkflowTab from '../components/WorkflowTab.vue';
import ChecklistTab from '../components/ChecklistTab.vue';
import DocumentsTab from '../components/DocumentsTab.vue';
import ReviewsTab from '../components/ReviewsTab.vue';
import CompletenessTab from '../components/CompletenessTab.vue';

const route = useRoute();
const projectId = Number(route.params.id);
const project = ref<any>(null);
const tab = ref('workflow');

const tabs = computed(() => [
  { id: 'workflow', label: 'Workflow' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'documents', label: 'Documents' },
  { id: 'completeness', label: 'Completeness Check' },
  { id: 'reviews', label: 'Reviews & Decisions' },
]);

onMounted(async () => {
  project.value = (await api.get(`/projects/${projectId}`)).project;
});

function downloadReport() {
  api.download(`/projects/${projectId}/report`, `status-report-${projectId}.html`);
}
</script>

<template>
  <div v-if="project">
    <div class="card mb-6 overflow-hidden !p-0">
      <div class="h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-400"></div>
      <div class="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-900">{{ project.name }}</h1>
          <p class="mt-0.5 text-sm text-slate-500">📍 {{ project.address }}, {{ project.municipality_name }}, RI</p>
          <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
            <span class="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">{{ project.units }} units</span>
            <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{{ project.dev_type.replace(/_/g, ' ') }}</span>
            <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{{ project.construction_kind.replace(/_/g, ' ') }}</span>
            <span class="rounded-md bg-blue-50 px-2 py-1 text-blue-700">{{ project.status.replace(/_/g, ' ') }}</span>
          </div>
          <p v-if="project.sewer_service === 'unknown' || project.water_service === 'unknown'" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Utility service ({{ [project.sewer_service === 'unknown' ? 'sewer' : '', project.water_service === 'unknown' ? 'water' : ''].filter(Boolean).join(', ') }})
            is unconfirmed — some approvals are marked conditional until confirmed with the Town.
          </p>
        </div>
        <button class="btn-secondary" @click="downloadReport">⬇ Status report</button>
      </div>
    </div>

    <div class="mb-6 flex gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
        class="whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-150"
        :class="tab === t.id ? 'bg-white text-indigo-700 shadow-soft' : 'text-slate-500 hover:text-slate-700'">
        {{ t.label }}
      </button>
    </div>

    <WorkflowTab v-if="tab === 'workflow'" :project-id="projectId" />
    <ChecklistTab v-else-if="tab === 'checklist'" :project-id="projectId" />
    <DocumentsTab v-else-if="tab === 'documents'" :project-id="projectId" />
    <CompletenessTab v-else-if="tab === 'completeness'" :project-id="projectId" />
    <ReviewsTab v-else-if="tab === 'reviews'" :project-id="projectId" />
  </div>
</template>
