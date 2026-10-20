<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number }>();
const comments = ref<any[]>([]);
const decisions = ref<any[]>([]);
const approvals = ref<any[]>([]);
const tasks = ref<any[]>([]);
const err = ref('');

const newComment = ref({ project_approval_id: '', comment_type: 'comment', agency_name: '', body: '' });
const newDecision = ref({ project_approval_id: '', decision: 'approved', decided_on: '', decided_by: '', notes: '', conditionsText: '' });
const responseDrafts = ref<Record<number, string>>({});
const busyAi = ref<number | null>(null);

async function load() {
  const [c, d, p, t] = await Promise.all([
    api.get(`/projects/${props.projectId}/comments`),
    api.get(`/projects/${props.projectId}/decisions`),
    api.get(`/projects/${props.projectId}/pathway`),
    api.get(`/projects/${props.projectId}/tasks`),
  ]);
  comments.value = c.comments; decisions.value = d.decisions;
  approvals.value = p.approvals.filter((a: any) => a.applicability !== 'not_applicable');
  tasks.value = t.tasks;
}

async function addComment() {
  err.value = '';
  try {
    await api.post(`/projects/${props.projectId}/approvals/${newComment.value.project_approval_id}/comments`, newComment.value);
    newComment.value = { project_approval_id: '', comment_type: 'comment', agency_name: '', body: '' };
    await load();
  } catch (e: any) { err.value = e.message; }
}

async function respond(commentId: number, useAi = false) {
  err.value = '';
  if (useAi) busyAi.value = commentId;
  try {
    await api.post(`/projects/${props.projectId}/comments/${commentId}/responses`,
      useAi ? { use_ai: true } : { body: responseDrafts.value[commentId] });
    responseDrafts.value[commentId] = '';
    await load();
  } catch (e: any) { err.value = e.message; }
  finally { busyAi.value = null; }
}

async function setCommentStatus(id: number, status: string) {
  await api.patch(`/projects/${props.projectId}/comments/${id}`, { status }); await load();
}

async function recordDecision() {
  err.value = '';
  try {
    const conditions = newDecision.value.conditionsText.split('\n').map(s => s.trim()).filter(Boolean);
    await api.post(`/projects/${props.projectId}/approvals/${newDecision.value.project_approval_id}/decisions`,
      { ...newDecision.value, conditions });
    newDecision.value = { project_approval_id: '', decision: 'approved', decided_on: '', decided_by: '', notes: '', conditionsText: '' };
    await load();
  } catch (e: any) { err.value = e.message; }
}

async function setCondition(id: number, status: string) {
  await api.patch(`/projects/${props.projectId}/conditions/${id}`, { status }); await load();
}
async function setTask(id: number, status: string) {
  await api.patch(`/projects/${props.projectId}/tasks/${id}`, { status }); await load();
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>

    <!-- Tasks -->
    <div class="card">
      <h2 class="mb-3 text-[1.05rem] font-bold text-slate-900">Tasks</h2>
      <p v-if="!tasks.length" class="text-sm text-slate-500">No tasks.</p>
      <div v-for="t in tasks" :key="t.id" class="flex items-center gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
        <span class="badge" :class="t.waiting_on === 'agency' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'">waiting on {{ t.waiting_on }}</span>
        <span :class="t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-700'">{{ t.title }}</span>
        <button v-if="t.status === 'open'" class="link ml-auto text-xs" @click="setTask(t.id, 'done')">mark done</button>
      </div>
    </div>

    <!-- Record agency feedback -->
    <div class="card">
      <h2 class="mb-3 text-[1.05rem] font-bold text-slate-900">Record agency feedback</h2>
      <div class="grid gap-3 sm:grid-cols-3">
        <select v-model="newComment.project_approval_id" class="input">
          <option value="" disabled>Select approval…</option>
          <option v-for="a in approvals" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <select v-model="newComment.comment_type" class="input">
          <option value="comment">Review comment</option>
          <option value="rai">Request for additional information (RAI)</option>
          <option value="condition_note">Condition note</option>
        </select>
        <input v-model="newComment.agency_name" class="input" placeholder="Agency (optional)" />
      </div>
      <textarea v-model="newComment.body" rows="2" class="input mt-3" placeholder="Feedback text…"></textarea>
      <button class="btn mt-2" :disabled="!newComment.project_approval_id || !newComment.body" @click="addComment">Record</button>
    </div>

    <!-- Comments -->
    <div class="card">
      <h2 class="mb-3 text-[1.05rem] font-bold text-slate-900">Agency feedback & responses</h2>
      <p v-if="!comments.length" class="text-sm text-slate-500">No feedback recorded.</p>
      <div v-for="c in comments" :key="c.id" class="border-b border-slate-100 py-3 last:border-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge" :class="c.comment_type === 'rai' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'">{{ c.comment_type }}</span>
          <span class="text-xs text-slate-500">{{ c.approval_name }}</span>
          <span v-if="c.agency_name" class="text-xs text-slate-500">from {{ c.agency_name }}</span>
          <span class="badge" :class="c.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'">{{ c.status }}</span>
          <button v-if="c.status !== 'resolved'" class="link ml-auto text-xs" @click="setCommentStatus(c.id, 'resolved')">resolve</button>
        </div>
        <p class="mt-1 text-sm text-slate-700">{{ c.body }}</p>
        <div v-for="r in c.responses || []" :key="r.id" class="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
          <span class="badge bg-purple-100 text-purple-700">{{ r.is_draft ? 'DRAFT' : 'sent' }}</span>
          <span v-if="r.ai_generated" class="badge ml-1 bg-brand-100 text-brand-700">AI-drafted — requires professional review before submission</span>
          <p class="mt-1 whitespace-pre-wrap">{{ r.body }}</p>
        </div>
        <div v-if="c.status !== 'resolved'" class="mt-2 flex gap-2">
          <input v-model="responseDrafts[c.id]" class="input" placeholder="Draft a response…" />
          <button class="btn-secondary shrink-0" :disabled="!responseDrafts[c.id]" @click="respond(c.id)">Save draft</button>
          <button class="btn-secondary shrink-0" :disabled="busyAi === c.id" @click="respond(c.id, true)"><AppIcon v-if="busyAi !== c.id" name="sparkles" :size="13" /> {{ busyAi === c.id ? 'Drafting…' : 'AI draft' }}</button>
        </div>
      </div>
    </div>

    <!-- Record decision -->
    <div class="card">
      <h2 class="mb-3 text-[1.05rem] font-bold text-slate-900">Record official decision</h2>
      <p class="mb-2 text-xs text-slate-500">Record decisions issued by the authority. The platform never determines outcomes itself.</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <select v-model="newDecision.project_approval_id" class="input">
          <option value="" disabled>Select approval…</option>
          <option v-for="a in approvals" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
        <select v-model="newDecision.decision" class="input">
          <option value="approved">Approved</option><option value="approved_with_conditions">Approved with conditions</option>
          <option value="denied">Denied</option><option value="continued">Continued</option>
        </select>
        <div><label class="label">Decision date</label><input v-model="newDecision.decided_on" type="date" class="input" /></div>
        <div><label class="label">Decided by (board/official)</label><input v-model="newDecision.decided_by" class="input" /></div>
        <div class="sm:col-span-2"><label class="label">Conditions (one per line)</label>
          <textarea v-model="newDecision.conditionsText" rows="2" class="input"></textarea></div>
      </div>
      <button class="btn mt-3" :disabled="!newDecision.project_approval_id || !newDecision.decided_on || !newDecision.decided_by" @click="recordDecision">Record decision</button>
    </div>

    <!-- Decisions -->
    <div v-if="decisions.length" class="card">
      <h2 class="mb-3 text-[1.05rem] font-bold text-slate-900">Decisions & conditions</h2>
      <div v-for="d in decisions" :key="d.id" class="border-b border-slate-100 py-2 last:border-0">
        <p class="text-sm"><strong>{{ d.approval_name }}</strong>:
          <span class="badge" :class="d.decision.startsWith('approved') ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'">{{ d.decision.replace(/_/g, ' ') }}</span>
          by {{ d.decided_by }} on {{ d.decided_on?.slice(0, 10) }}</p>
        <div v-for="cond in d.conditions || []" :key="cond.id" class="ml-4 mt-1 flex items-center gap-2 text-xs text-slate-600">
          <span class="badge" :class="cond.status === 'satisfied' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">{{ cond.status }}</span>
          {{ cond.description }}
          <button v-if="cond.status === 'open'" class="link" @click="setCondition(cond.id, 'satisfied')">mark satisfied</button>
        </div>
      </div>
    </div>
  </div>
</template>
