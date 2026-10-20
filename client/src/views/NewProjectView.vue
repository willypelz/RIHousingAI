<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import { useRouter } from 'vue-router';

const router = useRouter();
const municipalities = ref<any[]>([]);
const error = ref(''); const busy = ref(false);

// Only the essentials. Applicant details default from your account; utilities,
// zoning district, and the rest are refined in the Zoning tab after creation.
const form = ref({
  name: '', address: '', municipality_id: '' as number | '',
  dev_type: 'multi_family', units: 10, construction_kind: 'new_construction',
});

onMounted(async () => {
  municipalities.value = (await api.get('/municipalities')).municipalities;
});

async function submit() {
  busy.value = true; error.value = '';
  try {
    const payload = { ...form.value, units: Number(form.value.units), municipality_id: Number(form.value.municipality_id) };
    const { project } = await api.post('/projects', payload);
    await api.post(`/projects/${project.id}/pathway/generate`);
    router.push(`/projects/${project.id}`);
  } catch (e: any) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-extrabold text-slate-900">Register a Project</h1>
    <p class="mb-6 mt-1 text-sm text-slate-500">Just the basics — we'll generate a preliminary approval pathway, then the <strong>Zoning tab</strong> helps you confirm the district and utilities, which refines the pathway automatically.</p>
    <form class="card space-y-4 !p-6" @submit.prevent="submit">
      <div><label class="label">Project name</label><input v-model="form.name" required class="input" placeholder="e.g. Mendon Road Residences" /></div>
      <div><label class="label">Street address</label><input v-model="form.address" required class="input" placeholder="e.g. 100 Mendon Rd" /></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label">Municipality</label>
          <select v-model="form.municipality_id" required class="input">
            <option value="" disabled>Select a municipality…</option>
            <option v-for="m in municipalities" :key="m.id" :value="m.id">{{ m.name }}{{ m.coverage_status !== 'planned' ? ' (verified local data)' : '' }}</option>
          </select>
        </div>
        <div><label class="label">Development type</label>
          <select v-model="form.dev_type" class="input">
            <option value="multi_family">Multi-family</option><option value="townhouse">Townhouses</option>
            <option value="single_family">Single-family</option><option value="mixed_residential">Mixed residential</option>
          </select>
        </div>
        <div><label class="label">Number of units</label><input v-model.number="form.units" type="number" min="1" required class="input" /></div>
        <div><label class="label">Construction</label>
          <select v-model="form.construction_kind" class="input">
            <option value="new_construction">New construction</option><option value="conversion">Conversion</option><option value="addition">Addition</option>
          </select>
        </div>
      </div>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p class="text-xs text-slate-400">Applicant details default from your account — editable later.</p>
        <button class="btn w-full sm:w-auto" :disabled="busy">{{ busy ? '⏳ Building approval pathway…' : 'Create project →' }}</button>
      </div>
    </form>
  </div>
</template>
