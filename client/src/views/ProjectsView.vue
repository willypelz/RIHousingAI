<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';

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
        <h1 class="text-2xl font-extrabold text-slate-900">Your Projects</h1>
        <p class="mt-1 text-sm text-slate-500">Track approvals, checklists, and reviews in one place.</p>
      </div>
      <router-link to="/projects/new" class="btn">+ Register Project</router-link>
    </div>
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
      <div v-for="i in 4" :key="i" class="card space-y-3"><div class="skeleton h-5 w-2/3"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-3 w-1/2"></div></div>
    </div>
    <div v-else-if="!projects.length" class="card py-14 text-center">
      <p class="text-4xl">🏗️</p>
      <h2 class="mt-3 text-lg font-bold text-slate-800">No projects yet</h2>
      <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500">Register your development project and we'll build its approval pathway from official sources.</p>
      <router-link to="/projects/new" class="btn mt-5">Register your first project</router-link>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`" class="card card-hover group">
        <div class="flex items-start justify-between gap-2">
          <h2 class="font-bold text-slate-900 transition-colors group-hover:text-indigo-700">{{ p.name }}</h2>
          <span class="badge bg-indigo-50 text-indigo-700"><span class="badge-dot"></span>{{ p.status.replace(/_/g, ' ') }}</span>
        </div>
        <p class="mt-1 text-sm text-slate-500">📍 {{ p.address }}, {{ p.municipality_name }}, RI</p>
        <div class="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
          <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{{ p.units }} units</span>
          <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{{ p.dev_type.replace(/_/g, ' ') }}</span>
          <span class="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{{ p.construction_kind.replace(/_/g, ' ') }}</span>
        </div>
      </router-link>
    </div>
  </div>
</template>
