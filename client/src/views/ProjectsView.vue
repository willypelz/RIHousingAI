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
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-slate-800">Your Projects</h1>
      <router-link to="/projects/new" class="btn">+ Register Project</router-link>
    </div>
    <p v-if="loading" class="text-slate-500">Loading…</p>
    <div v-else-if="!projects.length" class="card text-center text-slate-500">
      <p class="mb-3">No projects yet.</p>
      <router-link to="/projects/new" class="btn">Register your first project</router-link>
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <router-link v-for="p in projects" :key="p.id" :to="`/projects/${p.id}`" class="card hover:border-blue-400">
        <div class="flex items-start justify-between">
          <h2 class="font-semibold text-slate-800">{{ p.name }}</h2>
          <span class="badge bg-blue-100 text-blue-800">{{ p.status.replace(/_/g, ' ') }}</span>
        </div>
        <p class="mt-1 text-sm text-slate-500">{{ p.address }}, {{ p.municipality_name }}, RI</p>
        <p class="mt-2 text-xs text-slate-400">{{ p.units }} units · {{ p.dev_type.replace(/_/g, ' ') }} · {{ p.construction_kind.replace(/_/g, ' ') }}</p>
      </router-link>
    </div>
  </div>
</template>
