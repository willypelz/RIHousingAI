<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import { useRouter } from 'vue-router';
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from './api/client';
import AssistantWidget from './components/AssistantWidget.vue';
import AppIcon from './components/AppIcon.vue';

const auth = useAuthStore();
const router = useRouter();
const unread = ref(0);
const showNotifs = ref(false);
const showMenu = ref(false);
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { showNotifs.value = false; showMenu.value = false; }
}
function onClickOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('[data-notifs]')) showNotifs.value = false;
}
onMounted(() => { loadNotifs(); document.addEventListener('keydown', onKeydown); document.addEventListener('click', onClickOutside); });
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); document.removeEventListener('click', onClickOutside); });
</script>

<template>
  <div class="min-h-screen">
    <nav v-if="auth.isAuthenticated" class="sticky top-0 z-30 border-b border-brand-950/30 bg-brand-950 shadow-lg" aria-label="Main navigation">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5">
        <router-link to="/" class="mr-2 flex items-center gap-2 rounded-lg text-lg font-extrabold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:mr-4">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-soft"><AppIcon name="home" :size="17" /></span>
          RIHousing<span class="text-brand-300">AI</span>
        </router-link>
        <div class="hidden items-center gap-1 md:flex">
          <router-link to="/" class="nav-link" :class="{ 'router-link-active': $route.path === '/' || $route.path.startsWith('/projects') }">Projects</router-link>
          <router-link to="/sources" class="nav-link">Official Sources</router-link>
          <router-link to="/assistant" class="nav-link">AI Assistant</router-link>
        </div>
        <div class="ml-auto flex items-center gap-2 sm:gap-3">
          <div class="relative" data-notifs>
            <button @click="toggleNotifs" :aria-expanded="showNotifs" aria-haspopup="true" aria-label="Notifications"
              class="relative rounded-lg p-1.5 text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
              <AppIcon name="bell" :size="18" />
              <span v-if="unread" class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">{{ unread }}</span>
            </button>
            <div v-if="showNotifs" role="menu" class="absolute right-0 z-20 mt-2 w-80 animate-fade-up rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-lift">
              <p class="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</p>
              <p v-if="!notifications.length" class="p-3 text-sm text-slate-500">You're all caught up.</p>
              <div v-for="n in notifications.slice(0, 10)" :key="n.id" role="menuitem" class="rounded-lg p-2.5 text-xs transition-colors hover:bg-slate-50">
                {{ n.message }}
                <div class="mt-0.5 text-[10px] text-slate-500">{{ new Date(n.created_at).toLocaleString() }}</div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white" aria-hidden="true">{{ auth.user?.name?.charAt(0)?.toUpperCase() }}</span>
            <span class="hidden text-xs font-medium text-brand-100 sm:block">{{ auth.user?.name }}</span>
            <span class="hidden text-[10px] text-brand-300 md:block">· {{ auth.user?.role?.replace('_', ' ') }}</span>
          </div>
          <button @click="logout" class="nav-link hidden md:block">Sign out</button>
          <button @click="showMenu = !showMenu" :aria-expanded="showMenu" aria-label="Open menu"
            class="rounded-lg p-1.5 text-brand-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 md:hidden">
            <AppIcon :name="showMenu ? 'x' : 'menu'" :size="18" />
          </button>
        </div>
        <div v-if="showMenu" class="flex w-full animate-fade-in flex-col gap-1 border-t border-white/10 pb-2 pt-2 md:hidden" @click="showMenu = false">
          <router-link to="/" class="nav-link">Projects</router-link>
          <router-link to="/sources" class="nav-link">Official Sources</router-link>
          <router-link to="/assistant" class="nav-link">AI Assistant</router-link>
          <button @click="logout" class="nav-link text-left">Sign out</button>
        </div>
      </div>
    </nav>
    <main class="mx-auto max-w-6xl px-4 py-8">
      <router-view v-slot="{ Component }">
        <component :is="Component" class="animate-fade-up" />
      </router-view>
    </main>
    <AssistantWidget v-if="auth.isAuthenticated && $route.path !== '/assistant'" />
    <footer v-if="auth.isAuthenticated" class="mx-auto max-w-6xl border-t border-slate-200 px-4 py-5 text-xs leading-relaxed text-slate-400">
      RIHousingAI provides administrative navigation assistance only. It does not perform zoning analysis or make approval decisions.
      Verify all requirements, fees, and deadlines with the responsible authorities.
    </footer>
  </div>
</template>
