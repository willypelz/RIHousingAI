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
    router.push(`/projects/${project.id}?tab=zoning`);
  } catch (e: any) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h1 class="text-2xl font-extrabold text-slate-900">Register a Project</h1>
    <p class="mb-6 mt-1 text-sm text-slate-500">Just the basics. Next you'll confirm the site's zoning & utilities, which builds your approval pathway.</p>
    <form class="card space-y-4 !p-6" @submit.prevent="submit">
      <div><label class="label" for="np-name">Project name</label><input id="np-name" v-model="form.name" required class="input" placeholder="e.g. Mendon Road Residences" /></div>
      <div><label class="label" for="np-address">Street address</label><input id="np-address" v-model="form.address" required class="input" placeholder="e.g. 100 Mendon Rd" /></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="np-muni">Municipality</label>
          <select id="np-muni" v-model="form.municipality_id" required class="input">
            <option value="" disabled>Select a municipality…</option>
            <option v-for="m in municipalities" :key="m.id" :value="m.id">{{ m.name }}{{ m.coverage_status !== 'planned' ? ' (verified local data)' : '' }}</option>
          </select>
        </div>
        <div><label class="label" for="np-type">Development type</label>
          <select id="np-type" v-model="form.dev_type" class="input">
            <option value="multi_family">Multi-family</option><option value="townhouse">Townhouses</option>
            <option value="single_family">Single-family</option><option value="mixed_residential">Mixed residential</option>
          </select>
        </div>
        <div><label class="label" for="np-units">Number of units</label><input id="np-units" v-model.number="form.units" type="number" min="1" required class="input" /></div>
        <div><label class="label" for="np-kind">Construction</label>
          <select id="np-kind" v-model="form.construction_kind" class="input">
            <option value="new_construction">New construction</option><option value="conversion">Conversion</option><option value="addition">Addition</option>
          </select>
        </div>
      </div>
      <p v-if="error" role="alert" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p class="hint">Applicant details default from your account — editable later.</p>
        <button class="btn w-full sm:w-auto" :disabled="busy">{{ busy ? 'Creating…' : 'Create & analyze zoning' }}</button>
      </div>
    </form>
  </div>
</template>
