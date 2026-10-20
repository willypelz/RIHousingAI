<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import AppIcon from '../components/AppIcon.vue';

const projects = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try { projects.value = (await api.get('/projects')).projects; }
  finally { loading.value = false; }
});
</script>

<template>
  <div>
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="page-title">Your Projects</h1>
        <p class="mt-1.5 text-[15px] text-slate-500">Zoning, approvals, and funding — one workspace per project.</p>
      </div>
      <router-link to="/projects/new" class="btn"><AppIcon name="plus" :size="15" /> Register Project</router-link>
    </div>
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading projects">
      <div v-for="i in 4" :key="i" class="card space-y-3"><div class="skeleton h-5 w-2/3"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-3 w-1/2"></div></div>
    </div>
    <div v-else-if="!projects.length" class="card py-14 text-center">
      <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><AppIcon name="building" :size="28" /></span>
      <h2 class="mt-3 text-lg font-bold text-slate-800">No projects yet</h2>
      <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500">Register your development project and we'll build its approval pathway from official sources.</p>
      <router-link to="/projects/new" class="btn mt-5">Register your first project</router-link>
    </div>
    <div v-if="projects.length" class="card divide-y divide-slate-100 !p-0">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`"
        class="group flex items-center gap-4 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><AppIcon name="building" :size="18" /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-slate-900 group-hover:text-brand-800">{{ p.name }}</p>
          <p class="mt-0.5 truncate text-sm text-slate-500">{{ p.address }}, {{ p.municipality_name }}, RI</p>
        </div>
        <div class="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex">
          <span class="rounded-md bg-slate-100 px-2 py-1">{{ p.units }} units</span>
          <span class="rounded-md bg-slate-100 px-2 py-1">{{ p.dev_type.replace(/_/g, ' ') }}</span>
        </div>
        <span class="badge hidden bg-brand-50 text-brand-800 md:inline-flex">{{ p.status.replace(/_/g, ' ') }}</span>
        <AppIcon name="arrow-right" :size="15" class="shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" />
      </router-link>
    </div>
  </div>
</template>
