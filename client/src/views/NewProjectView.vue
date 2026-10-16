<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import { useRouter } from 'vue-router';

const router = useRouter();
const municipalities = ref<any[]>([]);
const error = ref(''); const busy = ref(false);

const form = ref({
  name: '', address: '', municipality_id: 0, dev_type: 'multi_family', units: 10,
  construction_kind: 'new_construction', description: '', applicant_name: '',
  applicant_email: '', applicant_phone: '', representative_name: '', representative_email: '',
  existing_application_numbers: '', sewer_service: 'unknown', water_service: 'unknown',
  status: 'pre_application',
});

onMounted(async () => {
  municipalities.value = (await api.get('/municipalities')).municipalities;
  const cumberland = municipalities.value.find((m: any) => m.name === 'Cumberland');
  if (cumberland) form.value.municipality_id = cumberland.id;
});

async function submit() {
  busy.value = true; error.value = '';
  try {
    const payload = { ...form.value, units: Number(form.value.units), municipality_id: Number(form.value.municipality_id) };
    for (const k of ['applicant_email','representative_email'] as const) if (!payload[k]) (payload as any)[k] = null;
    const { project } = await api.post('/projects', payload);
    await api.post(`/projects/${project.id}/pathway/generate`);
    router.push(`/projects/${project.id}`);
  } catch (e: any) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="mb-4 text-xl font-bold text-slate-800">Register a Project</h1>
    <form class="card space-y-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2"><label class="label">Project name</label><input v-model="form.name" required class="input" placeholder="e.g. Mendon Road Residences" /></div>
        <div><label class="label">Street address</label><input v-model="form.address" required class="input" /></div>
        <div><label class="label">Municipality</label>
          <select v-model="form.municipality_id" class="input">
            <option v-for="m in municipalities" :key="m.id" :value="m.id">{{ m.name }}{{ m.coverage_status !== 'planned' ? '' : ' (procedural data coming soon)' }}</option>
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
        <div><label class="label">Current status</label>
          <select v-model="form.status" class="input">
            <option value="pre_application">Pre-application</option><option value="application_in_progress">Application in progress</option>
            <option value="submitted">Submitted</option><option value="under_review">Under review</option>
          </select>
        </div>
        <div><label class="label">Sewer service</label>
          <select v-model="form.sewer_service" class="input">
            <option value="unknown">Unknown — needs confirmation</option><option value="public_sewer">Public sewer</option><option value="septic">Septic (OWTS)</option>
          </select>
        </div>
        <div><label class="label">Water service</label>
          <select v-model="form.water_service" class="input">
            <option value="unknown">Unknown — needs confirmation</option><option value="public_water">Public water</option><option value="well">Well</option>
          </select>
        </div>
        <div class="sm:col-span-2"><label class="label">Project description</label><textarea v-model="form.description" rows="3" class="input"></textarea></div>
        <div><label class="label">Applicant name</label><input v-model="form.applicant_name" required class="input" /></div>
        <div><label class="label">Applicant email</label><input v-model="form.applicant_email" type="email" class="input" /></div>
        <div><label class="label">Applicant phone</label><input v-model="form.applicant_phone" class="input" /></div>
        <div><label class="label">Representative (optional)</label><input v-model="form.representative_name" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Existing application numbers (if any)</label><input v-model="form.existing_application_numbers" class="input" /></div>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button class="btn" :disabled="busy">{{ busy ? 'Creating & building approval pathway…' : 'Register project' }}</button>
    </form>
  </div>
</template>
