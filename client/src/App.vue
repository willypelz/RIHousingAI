<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';
import { ref, onMounted } from 'vue';
import { api } from './api/client';

const auth = useAuthStore();
const router = useRouter();
const unread = ref(0);
const showNotifs = ref(false);
const notifications = ref<any[]>([]);

async function loadNotifs() {
  if (!auth.isAuthenticated) return;
  try {
    const { notifications: n } = await api.get('/notifications');
    notifications.value = n;
    unread.value = n.filter((x: any) => !x.read).length;
  } catch { /* ignore */ }
}
async function toggleNotifs() {
  showNotifs.value = !showNotifs.value;
  if (showNotifs.value && unread.value) {
    await api.post('/notifications/read');
    unread.value = 0;
  }
}
function logout() { auth.logout(); router.push('/login'); }
onMounted(loadNotifs);
</script>

<template>
  <div class="min-h-screen">
    <nav v-if="auth.isAuthenticated" class="bg-blue-900 text-white">
      <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <router-link to="/" class="text-lg font-bold">RIHousing<span class="text-blue-300">AI</span></router-link>
        <router-link to="/" class="text-sm text-blue-100 hover:text-white">Projects</router-link>
        <router-link to="/sources" class="text-sm text-blue-100 hover:text-white">Official Sources</router-link>
        <router-link to="/assistant" class="text-sm text-blue-100 hover:text-white">AI Assistant</router-link>
        <div class="ml-auto flex items-center gap-4">
          <div class="relative">
            <button @click="toggleNotifs" class="relative text-sm text-blue-100 hover:text-white">
              🔔<span v-if="unread" class="absolute -right-2 -top-1 rounded-full bg-red-500 px-1.5 text-xs">{{ unread }}</span>
            </button>
            <div v-if="showNotifs" class="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-lg">
              <p v-if="!notifications.length" class="p-2 text-sm text-slate-500">No notifications</p>
              <div v-for="n in notifications.slice(0, 10)" :key="n.id" class="border-b border-slate-100 p-2 text-xs last:border-0">
                {{ n.message }}
                <div class="text-slate-400">{{ new Date(n.created_at).toLocaleString() }}</div>
              </div>
            </div>
          </div>
          <span class="text-xs text-blue-200">{{ auth.user?.name }} ({{ auth.user?.role?.replace('_', ' ') }})</span>
          <button @click="logout" class="text-sm text-blue-100 hover:text-white">Sign out</button>
        </div>
      </div>
    </nav>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <router-view />
    </main>
    <footer v-if="auth.isAuthenticated" class="mx-auto max-w-6xl px-4 pb-6 text-xs text-slate-400">
      RIHousingAI provides administrative navigation assistance only. It does not perform zoning analysis or make approval decisions.
      Verify all requirements, fees, and deadlines with the responsible authorities.
    </footer>
  </div>
</template>
