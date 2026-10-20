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
const showSidebar = ref(false);
const notifications = ref<any[]>([]);

const NAV = [
  { to: '/', label: 'Projects', icon: 'building', match: (p: string) => p === '/' || p.startsWith('/projects') },
  { to: '/sources', label: 'Official Sources', icon: 'scale', match: (p: string) => p.startsWith('/sources') },
  { to: '/assistant', label: 'AI Assistant', icon: 'chat', match: (p: string) => p.startsWith('/assistant') },
];

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
  if (e.key === 'Escape') { showNotifs.value = false; showSidebar.value = false; }
}
function onClickOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('[data-notifs]')) showNotifs.value = false;
}
onMounted(() => { loadNotifs(); document.addEventListener('keydown', onKeydown); document.addEventListener('click', onClickOutside); });
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); document.removeEventListener('click', onClickOutside); });
</script>

<template>
  <!-- Unauthenticated (login/register) stays standalone -->
  <router-view v-if="!auth.isAuthenticated" />

  <div v-else class="min-h-screen">
    <!-- Sidebar (desktop fixed, mobile drawer) -->
    <div v-if="showSidebar" class="fixed inset-0 z-40 bg-slate-900/50 md:hidden" aria-hidden="true" @click="showSidebar = false"></div>
    <aside class="fixed inset-y-0 left-0 z-50 flex w-60 -translate-x-full flex-col bg-brand-950 transition-transform duration-200 md:translate-x-0"
      :class="{ '!translate-x-0': showSidebar }" aria-label="Main navigation">
      <router-link to="/" class="flex items-center gap-2.5 px-5 pb-6 pt-6 text-[17px] font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        @click="showSidebar = false">
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white"><AppIcon name="home" :size="16" /></span>
        RIHousing<span class="text-brand-400">AI</span>
      </router-link>
      <nav class="flex-1 space-y-1 px-3">
        <p class="section-title mb-2 px-3 !text-brand-300/50">Workspace</p>
        <router-link v-for="n in NAV" :key="n.to" :to="n.to" class="side-link"
          :class="{ 'is-active': n.match($route.path) }" @click="showSidebar = false">
          <AppIcon :name="n.icon" :size="17" /> {{ n.label }}
        </router-link>
      </nav>
      <div class="border-t border-white/10 p-3">
        <div class="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden="true">
            {{ auth.user?.name?.charAt(0)?.toUpperCase() }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ auth.user?.name }}</p>
            <p class="truncate text-[11px] text-brand-300/70">{{ auth.user?.role?.replace('_', ' ') }}</p>
          </div>
          <button @click="logout" class="rounded-lg p-1.5 text-brand-300/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            aria-label="Sign out" title="Sign out">
            <AppIcon name="arrow-right" :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Content column -->
    <div class="flex min-h-screen flex-col md:pl-60">
      <!-- Top bar -->
      <header class="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-8">
        <button @click.stop="showSidebar = !showSidebar" :aria-expanded="showSidebar" aria-label="Open menu"
          class="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:hidden">
          <AppIcon name="menu" :size="18" />
        </button>
        <p class="text-sm font-semibold text-slate-700 md:hidden">RIHousing<span class="text-brand-600">AI</span></p>
        <div class="ml-auto flex items-center gap-2">
          <div class="relative" data-notifs>
            <button @click="toggleNotifs" :aria-expanded="showNotifs" aria-haspopup="true" aria-label="Notifications"
              class="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <AppIcon name="bell" :size="17" />
              <span v-if="unread" class="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{{ unread }}</span>
            </button>
            <div v-if="showNotifs" role="menu" class="absolute right-0 z-20 mt-2 w-80 animate-fade-up rounded-xl border border-slate-200 bg-white p-2 shadow-lift">
              <p class="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</p>
              <p v-if="!notifications.length" class="p-3 text-sm text-slate-500">You're all caught up.</p>
              <div v-for="n in notifications.slice(0, 10)" :key="n.id" role="menuitem" class="rounded-lg p-2.5 text-xs transition-colors hover:bg-slate-50">
                {{ n.message }}
                <div class="mt-0.5 text-[10px] text-slate-500">{{ new Date(n.created_at).toLocaleString() }}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        <router-view v-slot="{ Component }">
          <component :is="Component" class="animate-fade-up" />
        </router-view>
      </main>

      <footer class="mx-auto w-full max-w-5xl px-4 pb-6 text-xs leading-relaxed text-slate-400 sm:px-8">
        RIHousingAI helps you navigate zoning, approvals, and funding for Rhode Island housing from official sources.
        It does not make zoning determinations, approval decisions, or funding award estimates — verify all requirements, fees, and deadlines with the responsible authorities.
      </footer>
    </div>

    <AssistantWidget v-if="$route.path !== '/assistant'" />
  </div>
</template>
