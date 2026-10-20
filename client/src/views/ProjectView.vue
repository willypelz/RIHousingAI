<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import WorkflowTab from '../components/WorkflowTab.vue';
import ChecklistTab from '../components/ChecklistTab.vue';
import DocumentsTab from '../components/DocumentsTab.vue';
import ReviewsTab from '../components/ReviewsTab.vue';
import CompletenessTab from '../components/CompletenessTab.vue';
import ZoningTab from '../components/ZoningTab.vue';
import FundingTab from '../components/FundingTab.vue';
import AppIcon from '../components/AppIcon.vue';

const route = useRoute();
const projectId = Number(route.params.id);
const project = ref<any>(null);
const tab = ref('');

const utilitiesUnknown = computed(() =>
  project.value && (project.value.sewer_service === 'unknown' || project.value.water_service === 'unknown'));

// Zoning comes first: it confirms the site facts that generate the approval pathway.
const tabs = computed(() => [
  { id: 'zoning', label: '1 · Zoning', badge: utilitiesUnknown.value ? 'Start here' : null },
  { id: 'workflow', label: '2 · Workflow' },
  { id: 'checklist', label: '3 · Checklist' },
  { id: 'funding', label: 'Funding' },
  { id: 'documents', label: 'Documents' },
  { id: 'completeness', label: 'Completeness' },
  { id: 'reviews', label: 'Reviews' },
]);

onMounted(async () => {
  project.value = (await api.get(`/projects/${projectId}`)).project;
  // Land on Zoning until the site facts are confirmed, then default to Workflow
  tab.value = (route.query.tab as string) || (utilitiesUnknown.value ? 'zoning' : 'workflow');
});

async function reloadProject() {
  project.value = (await api.get(`/projects/${projectId}`)).project;
}

const reportLanguage = ref('en');
const REPORT_LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'pt', name: 'Português' },
  { code: 'kea', name: 'Kriolu' }, { code: 'ht', name: 'Kreyòl' }, { code: 'km', name: 'ខ្មែរ' },
];

function downloadReport() {
  api.download(`/projects/${projectId}/report?language=${reportLanguage.value}`, `status-report-${projectId}.html`);
}
</script>

<template>
  <div v-if="project">
    <div class="card mb-6 !p-0">
      <div class="flex flex-wrap items-start justify-between gap-3 p-6">
        <div class="flex items-start gap-4">
          <span class="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-soft sm:flex"><AppIcon name="building" :size="22" /></span>
          <div>
            <h1 class="page-title">{{ project.name }}</h1>
            <p class="mt-1 flex items-center gap-1 text-[15px] text-slate-500"><AppIcon name="map-pin" :size="15" /> {{ project.address }}, {{ project.municipality_name }}, RI</p>
            <div class="mt-3.5 flex flex-wrap gap-1.5 text-xs font-medium">
              <span class="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700">{{ project.units }} units</span>
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{{ project.dev_type.replace(/_/g, ' ') }}</span>
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{{ project.construction_kind.replace(/_/g, ' ') }}</span>
              <span class="rounded-lg bg-cyan-50 px-2.5 py-1 text-cyan-700">{{ project.status.replace(/_/g, ' ') }}</span>
            </div>
            <p v-if="project.sewer_service === 'unknown' || project.water_service === 'unknown'" class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Utility service ({{ [project.sewer_service === 'unknown' ? 'sewer' : '', project.water_service === 'unknown' ? 'water' : ''].filter(Boolean).join(', ') }})
              is unconfirmed — some approvals are marked conditional until confirmed with the Town.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <label class="sr-only" for="report-lang">Report language</label>
          <select id="report-lang" v-model="reportLanguage" class="input !w-auto !py-2 text-xs">
            <option v-for="l in REPORT_LANGUAGES" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>
          <button class="btn-secondary" @click="downloadReport"><AppIcon name="download" :size="15" /> Status report</button>
        </div>
      </div>
    </div>

    <div class="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-slate-200/50 p-1.5 ring-1 ring-slate-900/[0.04]" role="tablist" aria-label="Project sections">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
        role="tab" :aria-selected="tab === t.id" class="tab-btn relative">
        {{ t.label }}
        <span v-if="t.badge" class="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{{ t.badge }}</span>
      </button>
    </div>

    <template v-if="tab === 'workflow'">
      <button v-if="utilitiesUnknown" class="card card-hover mb-4 flex w-full items-center gap-3 !p-4 text-left !ring-amber-200"
        @click="tab = 'zoning'">
        <span class="stat-icon bg-amber-50 text-amber-600"><AppIcon name="map" :size="20" /></span>
        <span class="text-sm"><strong class="text-slate-900">Start with Zoning.</strong>
          <span class="text-slate-500"> Confirming the site's utilities refines this pathway — several approvals are conditional until then.</span></span>
        <AppIcon name="arrow-right" :size="16" class="ml-auto text-slate-400" />
      </button>
      <WorkflowTab :project-id="projectId" />
    </template>
    <ZoningTab v-else-if="tab === 'zoning'" :project-id="projectId" @updated="reloadProject" />
    <ChecklistTab v-else-if="tab === 'checklist'" :project-id="projectId" />
    <FundingTab v-else-if="tab === 'funding'" :project-id="projectId" />
    <DocumentsTab v-else-if="tab === 'documents'" :project-id="projectId" />
    <CompletenessTab v-else-if="tab === 'completeness'" :project-id="projectId" />
    <ReviewsTab v-else-if="tab === 'reviews'" :project-id="projectId" />
  </div>
  <div v-else class="space-y-4" aria-busy="true" aria-label="Loading project">
    <div class="card space-y-3"><div class="skeleton h-7 w-1/2"></div><div class="skeleton h-4 w-2/3"></div><div class="flex gap-2"><div class="skeleton h-6 w-20"></div><div class="skeleton h-6 w-24"></div><div class="skeleton h-6 w-28"></div></div></div>
    <div class="skeleton h-10 w-full"></div>
    <div class="card space-y-3"><div class="skeleton h-5 w-1/3"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-5/6"></div></div>
  </div>
</template>
