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
  <div class="fixed inset-0 flex items-start justify-center overflow-y-auto bg-gradient-to-br from-slate-50 via-brand-50/40 to-slate-50 p-6 sm:items-center">
    <div class="w-full max-w-sm animate-fade-up">
    <h1 class="mb-1 text-center text-2xl font-bold text-slate-900">Create your account</h1>
    <p class="mb-6 text-center text-sm text-slate-500">Start navigating your approval process</p>
    <form class="card space-y-4 !p-6" @submit.prevent="submit">
      <div><label class="label" for="reg-name">Full name</label><input id="reg-name" v-model="form.name" autocomplete="name" required class="input" /></div>
      <div><label class="label" for="reg-email">Email</label><input id="reg-email" v-model="form.email" type="email" autocomplete="email" required class="input" /></div>
      <div><label class="label" for="reg-password">Password (min 8 chars)</label><input id="reg-password" v-model="form.password" type="password" autocomplete="new-password" minlength="8" required class="input" /></div>
      <div><label class="label" for="reg-role">Role</label>
        <select id="reg-role" v-model="form.role" class="input"><option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option></select>
        <p class="hint mt-1">Municipal staff accounts are provisioned by administrators.</p>
      </div>
      <p v-if="error" role="alert" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>
      <button class="btn w-full" :disabled="busy">{{ busy ? 'Creating account…' : 'Register' }}</button>
      <p class="text-center text-sm text-slate-500">Have an account? <router-link to="/login" class="link">Sign in</router-link></p>
    </form>
    </div>
  </div>
</template>
