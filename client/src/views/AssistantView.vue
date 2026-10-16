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
      <div v-if="!messages.length" class="text-sm text-slate-500">
        <p class="mb-3">Ask about the approval process for your project. Answers are grounded in official sources with citations. Try:</p>
        <button v-for="s in SUGGESTIONS" :key="s" class="mb-1 block text-left text-blue-700 hover:underline" @click="send(s)">→ {{ s }}</button>
      </div>
      <div v-for="(m, i) in messages" :key="i" :class="m.role === 'user' ? 'text-right' : ''">
        <div class="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm"
          :class="m.role === 'user' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800'">{{ m.content }}</div>
      </div>
      <p v-if="busy" class="text-sm italic text-slate-400">Consulting official sources…</p>
    </div>

    <div v-if="lastSources.length" class="mb-3 rounded-md bg-blue-50 p-2 text-xs text-blue-800">
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
