<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { api } from '../api/client';

const projects = ref<any[]>([]);
const projectId = ref<string>('');
const conversationId = ref<number | null>(null);
const messages = ref<any[]>([]);
const input = ref('');
const busy = ref(false);
const lastSources = ref<any[]>([]);
const scroller = ref<HTMLElement | null>(null);

const SUGGESTIONS = [
  'What do I need to submit for my 10-unit project?',
  'Which department receives my application?',
  'What happens after submission?',
  'Which approvals and inspections remain before construction?',
];

onMounted(async () => {
  projects.value = (await api.get('/projects')).projects;
  if (projects.value.length) projectId.value = String(projects.value[0].id);
});

async function send(text?: string) {
  const message = text || input.value;
  if (!message || busy.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: message });
  busy.value = true;
  await nextTick(); scroller.value?.scrollTo(0, scroller.value.scrollHeight);
  try {
    const res = await api.post('/assistant/chat', {
      message,
      project_id: projectId.value ? Number(projectId.value) : null,
      conversation_id: conversationId.value,
    });
    conversationId.value = res.conversation_id;
    messages.value.push(res.message);
    lastSources.value = res.sources;
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Error: ${e.message}` });
  } finally {
    busy.value = false;
    await nextTick(); scroller.value?.scrollTo(0, scroller.value.scrollHeight);
  }
}
function newConversation() { conversationId.value = null; messages.value = []; lastSources.value = []; }
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-bold text-slate-800">AI Approval Assistant</h1>
      <div class="flex items-center gap-2">
        <select v-model="projectId" class="input w-64">
          <option value="">No project context</option>
          <option v-for="p in projects" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
        </select>
        <button class="btn-secondary" @click="newConversation">New chat</button>
      </div>
    </div>

    <div ref="scroller" class="card mb-3 h-96 space-y-3 overflow-y-auto">
      <div v-if="!messages.length" class="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500">
        <p class="text-3xl">💬</p>
        <p class="mb-4 mt-2 max-w-sm">Ask about the approval process for your project. Answers are grounded in official sources with citations.</p>
        <div class="flex max-w-md flex-wrap justify-center gap-2">
          <button v-for="s in SUGGESTIONS" :key="s"
            class="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition-all hover:border-brand-300 hover:bg-brand-100"
            @click="send(s)">{{ s }}</button>
        </div>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="flex animate-fade-up items-end gap-2" :class="m.role === 'user' ? 'flex-row-reverse' : ''">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-soft"
          :class="m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gradient-to-br from-brand-400 to-cyan-500 text-white'">
          {{ m.role === 'user' ? '🙂' : '🤖' }}
        </span>
        <div class="max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm shadow-soft"
          :class="m.role === 'user' ? 'rounded-br-md bg-gradient-to-b from-brand-600 to-brand-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'">{{ m.content }}</div>
      </div>
      <div v-if="busy" class="flex items-end gap-2">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 text-xs shadow-soft">🤖</span>
        <div class="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400"></span>
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400" style="animation-delay: 0.15s"></span>
          <span class="h-1.5 w-1.5 animate-typing rounded-full bg-slate-400" style="animation-delay: 0.3s"></span>
        </div>
      </div>
    </div>

    <div v-if="lastSources.length" class="mb-3 rounded-md bg-brand-50 p-2 text-xs text-brand-800">
      <strong>Sources consulted:</strong>
      <span v-for="s in lastSources" :key="s.id">
        · <a :href="s.url" target="_blank" class="underline">{{ s.title }}</a> (verified {{ s.last_verified_at?.slice(0, 10) }}) </span>
    </div>

    <form class="flex gap-2" @submit.prevent="send()">
      <input v-model="input" class="input" placeholder="Ask a question about your approval process…" :disabled="busy" />
      <button class="btn shrink-0" :disabled="busy || !input">Send</button>
    </form>
    <p class="mt-2 text-xs text-slate-400">
      Answers are informational, grounded in cited official sources, and never a substitute for confirmation from the responsible authority.
    </p>
  </div>
</template>
