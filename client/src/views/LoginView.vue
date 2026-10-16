<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const email = ref(''); const password = ref(''); const error = ref(''); const busy = ref(false);

async function submit() {
  busy.value = true; error.value = '';
  try { await auth.login(email.value, password.value); router.push('/'); }
  catch (e: any) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <div class="mx-auto mt-16 max-w-sm">
    <h1 class="mb-1 text-center text-2xl font-bold text-blue-900">RIHousing<span class="text-blue-500">AI</span></h1>
    <p class="mb-6 text-center text-sm text-slate-500">Rhode Island housing approval navigation</p>
    <form class="card space-y-4" @submit.prevent="submit">
      <div><label class="label">Email</label><input v-model="email" type="email" required class="input" /></div>
      <div><label class="label">Password</label><input v-model="password" type="password" required class="input" /></div>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <button class="btn w-full justify-center" :disabled="busy">Sign in</button>
      <p class="text-center text-sm text-slate-500">No account? <router-link to="/register" class="text-blue-700 hover:underline">Register</router-link></p>
    </form>
  </div>
</template>
