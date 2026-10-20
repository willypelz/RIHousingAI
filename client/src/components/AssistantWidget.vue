<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import { renderMarkdown } from '../lib/markdown';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const open = ref(false);
const conversationId = ref<number | null>(null);
const messages = ref<any[]>([]);
const input = ref('');
const busy = ref(false);
const lastSources = ref<any[]>([]);
const scroller = ref<HTMLElement | null>(null);
const projectName = ref('');

const SUGGESTIONS = [
  'How do I find the zoning district for my lot?',
  'What do I need to submit for my project?',
  'Could the ADU reforms add units to my lot?',
  'What funding programs fit affordable housing?',
];

// Auto-detect project context from the current route
const projectId = computed(() => {
  const m = route.path.match(/^\/projects\/(\d+)/);
  return m ? Number(m[1]) : null;
});

watch(projectId, async (id) => {
  projectName.value = '';
  if (id) {
    try { projectName.value = (await api.get(`/projects/${id}`)).project.name; } catch { /* no access */ }
  }
});

async function scrollDown() {
  await nextTick();
  scroller.value?.scrollTo(0, scroller.value.scrollHeight);
}

async function send(text?: string) {
  const message = text || input.value;
  if (!message || busy.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: message });
  busy.value = true;
  scrollDown();
  try {
    const res = await api.post('/assistant/chat', {
      message, project_id: projectId.value, conversation_id: conversationId.value,
    });
    conversationId.value = res.conversation_id;
    messages.value.push(res.message);
    lastSources.value = res.sources;
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Error: ${e.message}` });
  } finally {
    busy.value = false;
    scrollDown();
  }
}

function reset() { conversationId.value = null; messages.value = []; lastSources.value = []; }
</script>

<template>
  <div>
    <!-- Floating action button -->
    <button v-if="!open" @click="open = true"
      class="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lift transition-all duration-200 hover:bg-brand-600 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      aria-label="Open AI assistant"><AppIcon name="chat" :size="24" /></button>

    <!-- Chat panel -->
    <div v-if="open"
      class="fixed inset-0 z-40 flex flex-col overflow-hidden bg-white shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[80vh] sm:w-[400px] sm:animate-fade-up sm:rounded-2xl sm:border sm:border-slate-200">
      <!-- Header -->
      <div class="flex items-center gap-2 bg-brand-900 px-4 py-3 text-white">
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><AppIcon name="sparkles" :size="16" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold">AI Approval Assistant</p>
          <p class="truncate text-[11px] text-brand-200">{{ projectName ? `Context: ${projectName}` : 'General — open a project for project-specific answers' }}</p>
        </div>
        <button @click="reset" class="rounded-lg p-1.5 text-brand-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300" aria-label="New chat" title="New chat"><AppIcon name="refresh" :size="14" /></button>
        <button @click="open = false" class="rounded-lg p-1.5 text-brand-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300" aria-label="Close assistant"><AppIcon name="x" :size="16" /></button>
      </div>

      <!-- Messages -->
      <div ref="scroller" class="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
        <div v-if="!messages.length" class="flex h-full flex-col items-center justify-center text-center text-xs text-slate-500">
          <p class="mb-3 max-w-[260px]">Ask about your approval process. Answers cite official sources.</p>
          <div class="flex flex-wrap justify-center gap-1.5">
            <button v-for="s in SUGGESTIONS" :key="s"
              class="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
              @click="send(s)">{{ s }}</button>
          </div>
        </div>
        <div v-for="(m, i) in messages" :key="i" class="flex animate-fade-up items-end gap-1.5" :class="m.role === 'user' ? 'flex-row-reverse' : ''">
          <div v-if="m.role === 'user'" class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-700 px-3 py-2 text-left text-xs text-white shadow-soft">{{ m.content }}</div>
          <div v-else class="max-w-[85%] space-y-0.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-800 shadow-soft" v-html="renderMarkdown(m.content)"></div>
        </div>
        <div v-if="busy" class="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2.5 shadow-soft" style="width: fit-content">
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400"></span>
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400" style="animation-delay: 0.15s"></span>
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400" style="animation-delay: 0.3s"></span>
        </div>
      </div>

      <!-- Sources -->
      <div v-if="lastSources.length" class="border-t border-slate-100 bg-brand-50/60 px-3 py-1.5 text-[10px] leading-relaxed text-brand-800">
        <strong>Sources:</strong>
        <template v-for="(s, i) in lastSources.slice(0, 3)" :key="s.id">{{ i ? ' · ' : ' ' }}<a :href="s.url" target="_blank" class="underline">{{ s.title.slice(0, 45) }}{{ s.title.length > 45 ? '…' : '' }}</a></template>
      </div>

      <!-- Input -->
      <form class="flex gap-2 border-t border-slate-200 bg-white p-2.5" @submit.prevent="send()">
        <input v-model="input" class="input !py-1.5 text-xs" placeholder="Ask a question…" :disabled="busy" />
        <button class="btn shrink-0 !px-3 !py-1.5 text-xs" :disabled="busy || !input">Send</button>
      </form>
    </div>
  </div>
</template>
