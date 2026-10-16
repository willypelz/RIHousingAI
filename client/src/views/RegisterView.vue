<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const form = ref({ name: '', email: '', password: '', role: 'developer' });
const error = ref(''); const busy = ref(false);

const roles = [
  { value: 'developer', label: 'Developer / Property Owner' },
  { value: 'architect_engineer', label: 'Architect / Engineer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'consultant', label: 'Planning Consultant' },
];

async function submit() {
  busy.value = true; error.value = '';
  try { await auth.register(form.value); router.push('/'); }
  catch (e: any) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="mx-auto mt-16 max-w-sm">
    <h1 class="mb-6 text-center text-2xl font-bold text-blue-900">Create account</h1>
    <form class="card space-y-4" @submit.prevent="submit">
      <div><label class="label">Full name</label><input v-model="form.name" required class="input" /></div>
      <div><label class="label">Email</label><input v-model="form.email" type="email" required class="input" /></div>
      <div><label class="label">Password (min 8 chars)</label><input v-model="form.password" type="password" minlength="8" required class="input" /></div>
      <div><label class="label">Role</label>
        <select v-model="form.role" class="input"><option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option></select>
        <p class="mt-1 text-xs text-slate-400">Municipal staff accounts are provisioned by administrators.</p>
      </div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button class="btn w-full justify-center" :disabled="busy">Register</button>
      <p class="text-center text-sm text-slate-500">Have an account? <router-link to="/login" class="text-blue-700 hover:underline">Sign in</router-link></p>
    </form>
  </div>
</template>
