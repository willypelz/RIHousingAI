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
  <div class="fixed inset-0 flex">
    <div class="hidden flex-1 flex-col justify-between bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-10 text-white lg:flex">
      <div class="text-xl font-extrabold tracking-tight">RIHousing<span class="text-brand-300">AI</span></div>
      <div class="animate-fade-up">
        <h1 class="text-4xl font-extrabold leading-tight tracking-tight">Navigate Rhode Island<br />housing approvals<br /><span class="bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text text-transparent">with confidence.</span></h1>
        <p class="mt-4 max-w-md text-sm leading-relaxed text-brand-200">Source-backed checklists, workflow tracking, AI completeness checks, and an assistant grounded in official municipal and state procedures.</p>
        <div class="mt-6 flex gap-6 text-xs text-brand-300">
          <div><p class="text-2xl font-bold text-white">39</p>municipalities modeled</div>
          <div><p class="text-2xl font-bold text-white">100%</p>source-cited guidance</div>
          <div><p class="text-2xl font-bold text-white">0</p>invented fees or deadlines</div>
        </div>
      </div>
      <p class="text-xs text-brand-400">Administrative navigation only — not zoning analysis or approval decisions.</p>
    </div>
    <div class="flex flex-1 items-center justify-center bg-slate-50 p-6">
      <div class="w-full max-w-sm animate-fade-up">
        <h2 class="mb-1 text-2xl font-bold text-slate-900">Welcome back</h2>
        <p class="mb-6 text-sm text-slate-500">Sign in to your workspace</p>
        <form class="card space-y-4 !p-6" @submit.prevent="submit">
          <div><label class="label" for="login-email">Email</label><input id="login-email" v-model="email" type="email" autocomplete="email" required class="input" placeholder="you@example.com" /></div>
          <div><label class="label" for="login-password">Password</label><input id="login-password" v-model="password" type="password" autocomplete="current-password" required class="input" placeholder="••••••••" /></div>
          <p v-if="error" role="alert" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</p>
          <button class="btn w-full" :disabled="busy">{{ busy ? 'Signing in…' : 'Sign in' }}</button>
          <p class="text-center text-sm text-slate-500">No account? <router-link to="/register" class="link">Register</router-link></p>
        </form>
      </div>
    </div>
  </div>
</template>
