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
    <div class="grid gap-4 sm:grid-cols-2">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`" class="card card-hover group">
        <div class="flex items-start gap-3.5">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"><AppIcon name="building" :size="20" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-[1.05rem] font-bold text-slate-900 transition-colors group-hover:text-brand-700">{{ p.name }}</h2>
              <span class="badge shrink-0 bg-brand-50 text-brand-700"><span class="badge-dot"></span>{{ p.status.replace(/_/g, ' ') }}</span>
            </div>
            <p class="mt-1 flex items-center gap-1 text-sm text-slate-500"><AppIcon name="map-pin" :size="14" /> {{ p.address }}, {{ p.municipality_name }}, RI</p>
            <div class="mt-3.5 flex flex-wrap gap-1.5 text-xs font-medium">
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{{ p.units }} units</span>
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{{ p.dev_type.replace(/_/g, ' ') }}</span>
              <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">{{ p.construction_kind.replace(/_/g, ' ') }}</span>
            </div>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
