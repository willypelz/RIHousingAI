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
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-slate-800">{{ project.name }}</h1>
        <p class="text-sm text-slate-500">
          {{ project.address }}, {{ project.municipality_name }}, RI ·
          {{ project.units }} units · {{ project.dev_type.replace(/_/g, ' ') }} · {{ project.construction_kind.replace(/_/g, ' ') }}
        </p>
        <p v-if="project.sewer_service === 'unknown' || project.water_service === 'unknown'" class="mt-1 text-xs text-amber-600">
          ⚠ Utility service ({{ [project.sewer_service === 'unknown' ? 'sewer' : '', project.water_service === 'unknown' ? 'water' : ''].filter(Boolean).join(', ') }})
          is unconfirmed — some approvals are marked conditional until confirmed with the Town.
        </p>
      </div>
      <button class="btn-secondary" @click="downloadReport">⬇ Status report</button>
    </div>

    <div class="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
        class="whitespace-nowrap px-4 py-2 text-sm font-medium"
        :class="tab === t.id ? 'border-b-2 border-blue-700 text-blue-700' : 'text-slate-500 hover:text-slate-700'">
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
