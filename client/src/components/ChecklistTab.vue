<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number }>();
const items = ref<any[]>([]);
const approvals = ref<Record<string, any>>({});
const comments = ref<any[]>([]);
const err = ref('');

const printLanguage = ref('en');
const printing = ref(false);
const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'pt', name: 'Português' },
  { code: 'kea', name: 'Kriolu' }, { code: 'ht', name: 'Kreyòl' }, { code: 'km', name: 'ខ្មែរ' },
];

// Per-item feedback UI state
const openThread = ref<number | null>(null);
const newComment = ref<Record<number, { type: string; body: string }>>({});
const responseDrafts = ref<Record<number, string>>({});
const busyAi = ref<number | null>(null);
const commentBusy = ref<number | null>(null);

const grouped = computed(() => {
  const g: Record<string, any[]> = {};
  for (const i of items.value) (g[i.approval_name] ||= []).push(i);
  return g;
});

const totals = computed(() => {
  const done = items.value.filter(i => i.status === 'complete').length;
  const na = items.value.filter(i => i.status === 'not_applicable').length;
  return { done, total: items.value.length, left: items.value.length - done - na };
});

const TYPE_ICONS: Record<string, string> = {
  form: 'document', document: 'paperclip', plan: 'map', certification: 'pencil', fee: 'currency',
  instruction: 'info', prerequisite: 'link', referral: 'arrow-right', hearing: 'scale',
};

async function load() {
  const [cl, pw, cm] = await Promise.all([
    api.get(`/projects/${props.projectId}/checklist`),
    api.get(`/projects/${props.projectId}/pathway`),
    api.get(`/projects/${props.projectId}/comments`),
  ]);
  items.value = cl.items;
  comments.value = cm.comments;
  const map: Record<string, any> = {};
  for (const a of pw.approvals) {
    map[a.name] = {
      pa_id: a.id,
      contact: [a.agency_name, a.agency_department].filter(Boolean).join(' — ') || 'Confirm with the town',
      phone: a.agency_phone, website: a.agency_website,
      estimate: a.processing_estimate,
      confirm: a.applicability === 'conditional' || !a.agency_name,
    };
  }
  approvals.value = map;
}

const itemComments = (itemId: number) => comments.value.filter(c => c.checklist_item_id === itemId);
const openCount = (itemId: number) => itemComments(itemId).filter(c => c.status !== 'resolved').length;
const groupOpenCount = (group: any[]) => group.reduce((n, i) => n + openCount(i.id), 0);

async function toggleItem(item: any) {
  const status = item.status === 'complete' ? 'pending' : 'complete';
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { status });
  await load();
}
async function setStatus(item: any, status: string) {
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { status });
  await load();
}

async function setTargetDate(item: any, date: string) {
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { target_date: date || null });
  await load();
}

const today = new Date().toISOString().slice(0, 10);
const isMissed = (item: any) =>
  item.target_date && item.target_date < today && !['complete', 'not_applicable'].includes(item.status);

async function addComment(item: any) {
  const f = newComment.value[item.id];
  if (!f?.body) return;
  commentBusy.value = item.id; err.value = '';
  try {
    await api.post(`/projects/${props.projectId}/approvals/${item.project_approval_id}/comments`,
      { body: f.body, comment_type: f.type || 'comment', checklist_item_id: item.id });
    newComment.value[item.id] = { type: 'comment', body: '' };
    await load();
  } catch (e: any) { err.value = e.message; }
  finally { commentBusy.value = null; }
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

async function resolveComment(id: number) {
  await api.patch(`/projects/${props.projectId}/comments/${id}`, { status: 'resolved' });
  await load();
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One-page printable checklist, translated when a non-English language is selected. */
async function printChecklist() {
  printing.value = true; err.value = '';
  try {
    const labels = ['Approvals checklist', 'Generated', 'Contact', 'Published timeline', 'Confirm with the town',
      'done', 'This is a working checklist from official sources, not an official determination. Confirm requirements, fees, and timelines with the responsible authorities.'];
    let texts = [...labels, ...Object.keys(grouped.value), ...items.value.map(i => i.title)];
    if (printLanguage.value !== 'en') {
      const out: string[] = [];
      for (let i = 0; i < texts.length; i += 80) {
        const { translations } = await api.post(`/projects/${props.projectId}/zoning/translate`, { language: printLanguage.value, texts: texts.slice(i, i + 80) });
        out.push(...translations);
      }
      texts = out;
    }
    const T: Record<string, string> = {};
    [...labels, ...Object.keys(grouped.value), ...items.value.map(i => i.title)].forEach((orig, i) => { T[orig] = texts[i]; });

    const groupsHtml = Object.entries(grouped.value).map(([name, group]) => {
      const a = approvals.value[name] || {};
      return `<section>
        <h2>${esc(T[name] || name)} <span class="count">${group.filter((i: any) => i.status === 'complete').length}/${group.length} ${esc(T['done'])}</span></h2>
        <p class="meta">${esc(T['Contact'])}: ${esc(a.contact)}${a.phone ? ' · ' + esc(a.phone) : ''}${a.confirm ? ` · <em>${esc(T['Confirm with the town'])}</em>` : ''}</p>
        ${a.estimate ? `<p class="meta">${esc(T['Published timeline'])}: ${esc(a.estimate)}</p>` : ''}
        <ul>${group.map((i: any) => `<li class="${i.status === 'complete' ? 'done' : ''}"><span class="box">${i.status === 'complete' ? '☑' : '☐'}</span> ${esc(T[i.title] || i.title)}</li>`).join('')}</ul>
      </section>`;
    }).join('');

    const w = window.open('', '_blank');
    if (!w) throw new Error('Pop-up blocked — allow pop-ups to print.');
    w.document.write(`<!doctype html><html><head><title>${esc(T['Approvals checklist'])}</title><style>
      body{font-family:system-ui;max-width:720px;margin:1.5rem auto;padding:0 1rem;color:#1a202c;font-size:12px;line-height:1.45}
      h1{font-size:1.25rem;margin-bottom:.1rem} .sub{color:#64748b;font-size:.75rem;margin-bottom:1rem}
      h2{font-size:.9rem;margin:.9rem 0 .15rem;border-bottom:1px solid #e2e8f0;padding-bottom:.15rem}
      .count{font-weight:400;color:#94a3b8;font-size:.72rem} .meta{color:#64748b;font-size:.72rem;margin:.1rem 0}
      ul{list-style:none;padding:0;margin:.3rem 0;columns:2;column-gap:2rem} li{margin:.15rem 0;break-inside:avoid}
      li.done{color:#94a3b8;text-decoration:line-through} .box{font-size:.9rem}
      .disclaimer{margin-top:1rem;font-size:.7rem;color:#92400e;background:#fffbeb;padding:.5rem .7rem;border-radius:6px}
      @media print{body{margin:.5rem auto}}
    </style></head><body>
      <h1>${esc(T['Approvals checklist'])}</h1>
      <p class="sub">${esc(T['Generated'])} ${new Date().toISOString().slice(0, 10)} · RIHousingAI</p>
      ${groupsHtml}
      <p class="disclaimer">${esc(T[labels[6]])}</p>
    </body></html>`);
    w.document.close();
    w.print();
  } catch (e: any) { err.value = e.message; }
  finally { printing.value = false; }
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <!-- Progress header -->
    <div class="card flex flex-wrap items-center gap-5 !py-5">
      <div class="relative h-16 w-16 shrink-0" role="img" :aria-label="`${totals.done} of ${totals.total} items complete`">
        <svg viewBox="0 0 36 36" class="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" class="stroke-slate-100" stroke-width="3.5" />
          <circle cx="18" cy="18" r="15.9" fill="none" class="stroke-brand-500 transition-all duration-500" stroke-width="3.5"
            stroke-linecap="round" :stroke-dasharray="`${(totals.done / Math.max(1, totals.total)) * 100}, 100`" />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900">
          {{ Math.round((totals.done / Math.max(1, totals.total)) * 100) }}%
        </span>
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-[1.05rem] font-bold text-slate-900">{{ totals.done }} of {{ totals.total }} items complete</h2>
        <p class="hint mt-0.5">{{ totals.left }} to go · every item cites an official source — fees are never estimated.</p>
      </div>
      <div class="flex items-center gap-1.5">
        <label class="sr-only" for="cl-lang">Printout language</label>
        <select id="cl-lang" v-model="printLanguage" class="input !w-auto !py-2 text-xs">
          <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
        <button class="btn-secondary" :disabled="printing" @click="printChecklist">
          <AppIcon name="printer" :size="15" /> {{ printing ? 'Preparing…' : 'Print' }}
        </button>
      </div>
    </div>
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>

    <!-- Approval groups -->
    <div v-for="(group, approval) in grouped" :key="approval" class="card !p-0">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-6 py-4">
        <div class="min-w-0 flex-1">
          <h2 class="text-[1.05rem] font-bold text-slate-900">{{ approval }}</h2>
          <p v-if="approvals[approval]" class="hint mt-0.5">
            {{ approvals[approval].contact }}<span v-if="approvals[approval].phone"> · {{ approvals[approval].phone }}</span>
            <span v-if="approvals[approval].confirm" class="font-medium text-amber-600"> · confirm with the town</span>
          </p>
          <p v-if="approvals[approval]?.estimate" class="hint mt-0.5">Published timeline: {{ approvals[approval].estimate }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="groupOpenCount(group)" class="badge bg-amber-100 text-amber-800">
            <AppIcon name="chat" :size="11" /> {{ groupOpenCount(group) }} open feedback
          </span>
          <div class="w-28">
            <p class="mb-1 text-right text-[11px] font-semibold text-slate-500">{{ group.filter(i => i.status === 'complete').length }}/{{ group.length }}</p>
            <div class="progress-track"><div class="progress-fill" :style="{ width: `${(group.filter(i => i.status === 'complete').length / group.length) * 100}%` }"></div></div>
          </div>
        </div>
      </div>

      <!-- Items -->
      <div v-for="item in group" :key="item.id" class="border-b border-slate-50 last:border-0">
        <div class="group/item flex items-start gap-3 px-6 py-3 transition-colors hover:bg-slate-50/60">
          <button class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            :class="item.status === 'complete' ? 'bg-brand-600 ring-brand-600 text-white' : 'bg-white ring-slate-300 text-transparent hover:ring-brand-400'"
            :aria-label="`Mark ${item.title} ${item.status === 'complete' ? 'incomplete' : 'complete'}`"
            @click="toggleItem(item)">
            <AppIcon name="check" :size="12" />
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <AppIcon :name="TYPE_ICONS[item.item_type] || 'info'" :size="13" class="text-slate-400" />
              <p class="text-sm font-medium" :class="item.status === 'complete' ? 'text-slate-400 line-through' : item.status === 'not_applicable' ? 'text-slate-400' : 'text-slate-800'">{{ item.title }}</p>
              <span v-if="item.status === 'in_progress'" class="badge bg-brand-50 text-brand-700">in progress</span>
              <span v-if="item.status === 'not_applicable'" class="badge bg-slate-100 text-slate-500">n/a</span>
              <span v-if="isMissed(item)" class="badge bg-rose-100 text-rose-700"><AppIcon name="bell" :size="10" /> target missed</span>
            </div>
            <p class="mt-0.5 text-xs leading-relaxed text-slate-500">{{ item.description }}</p>
            <p v-if="item.item_type === 'fee' && item.fee_note" class="mt-0.5 text-[11px] text-amber-700">Fee: {{ item.fee_note }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              <span>{{ item.responsible_authority }}</span>
              <a v-if="item.source_url" :href="item.source_url" target="_blank" class="link inline-flex items-center gap-0.5">source <AppIcon name="external" :size="10" /></a>
              <a v-if="item.submission_link" :href="item.submission_link" target="_blank" class="link inline-flex items-center gap-0.5">submit <AppIcon name="external" :size="10" /></a>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <input type="date" :value="item.target_date || ''" :aria-label="`Your target date for ${item.title}`"
              :title="'Your planning target — not an official deadline. Shows on the timeline and calendar.'"
              class="rounded-lg border-0 bg-transparent p-1 text-[11px] ring-1 transition-all focus-visible:outline-none focus-visible:ring-brand-500"
              :class="isMissed(item) ? 'text-rose-600 ring-rose-200' : item.target_date ? 'text-slate-600 ring-slate-200' : 'text-slate-400 ring-transparent hover:ring-slate-200'"
              @change="setTargetDate(item, ($event.target as HTMLInputElement).value)" />
            <button class="relative rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              :class="openThread === item.id ? 'bg-brand-50 text-brand-700' : openCount(item.id) ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'"
              :aria-expanded="openThread === item.id"
              :aria-label="`Feedback for ${item.title} (${itemComments(item.id).length})`"
              @click="openThread = openThread === item.id ? null : item.id">
              <AppIcon name="chat" :size="16" />
              <span v-if="openCount(item.id)" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">{{ openCount(item.id) }}</span>
            </button>
            <select class="rounded-lg border-0 bg-transparent p-1 text-[11px] text-slate-400 ring-1 ring-transparent transition-all hover:ring-slate-200 focus-visible:outline-none focus-visible:ring-brand-500 group-hover/item:text-slate-600"
              :value="item.status" :aria-label="`Status of ${item.title}`"
              @change="setStatus(item, ($event.target as HTMLSelectElement).value)">
              <option value="pending">pending</option><option value="in_progress">in progress</option>
              <option value="complete">complete</option><option value="not_applicable">n/a</option>
            </select>
          </div>
        </div>

        <!-- Per-item feedback thread -->
        <div v-if="openThread === item.id" class="animate-fade-in border-t border-slate-100 bg-slate-50/70 px-6 py-4 pl-14">
          <div v-for="c in itemComments(item.id)" :key="c.id" class="mb-3 rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge" :class="c.comment_type === 'rai' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'">{{ c.comment_type }}</span>
              <span v-if="c.agency_name" class="text-[11px] text-slate-500">from {{ c.agency_name }}</span>
              <span class="badge" :class="c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'">{{ c.status }}</span>
              <span class="ml-auto text-[10px] text-slate-400">{{ new Date(c.created_at).toLocaleDateString() }}</span>
              <button v-if="c.status !== 'resolved'" class="link text-xs" @click="resolveComment(c.id)">resolve</button>
            </div>
            <p class="mt-1.5 text-sm text-slate-700">{{ c.body }}</p>
            <div v-for="r in c.responses || []" :key="r.id" class="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
              <span class="badge bg-violet-100 text-violet-700">{{ r.is_draft ? 'DRAFT' : 'sent' }}</span>
              <span v-if="r.ai_generated" class="badge ml-1 bg-brand-100 text-brand-700">AI-drafted — review before sending</span>
              <p class="mt-1 whitespace-pre-wrap leading-relaxed">{{ r.body }}</p>
            </div>
            <div v-if="c.status !== 'resolved'" class="mt-2 flex flex-wrap gap-2">
              <input v-model="responseDrafts[c.id]" class="input min-w-40 flex-1 !py-1.5 text-xs" placeholder="Draft a response…"
                @keydown.enter="responseDrafts[c.id] && respond(c.id)" />
              <button class="btn-secondary shrink-0 !px-3 !py-1.5 text-xs" :disabled="!responseDrafts[c.id]" @click="respond(c.id)">Save draft</button>
              <button class="btn-secondary shrink-0 !px-3 !py-1.5 text-xs" :disabled="busyAi === c.id" @click="respond(c.id, true)">
                <AppIcon v-if="busyAi !== c.id" name="sparkles" :size="12" /> {{ busyAi === c.id ? 'Drafting…' : 'AI draft' }}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <select v-model="(newComment[item.id] ??= { type: 'comment', body: '' }).type" class="input !w-auto !py-1.5 text-xs" :aria-label="`Feedback type for ${item.title}`">
              <option value="comment">Comment</option>
              <option value="rai">Request for info</option>
              <option value="condition_note">Condition note</option>
            </select>
            <input v-model="(newComment[item.id] ??= { type: 'comment', body: '' }).body" class="input min-w-44 flex-1 !py-1.5 text-xs"
              :placeholder="`Record feedback on “${item.title}”…`" @keydown.enter="newComment[item.id]?.body && addComment(item)" />
            <button class="btn shrink-0 !px-3 !py-1.5 text-xs" :disabled="!newComment[item.id]?.body || commentBusy === item.id"
              @click="addComment(item)">{{ commentBusy === item.id ? 'Saving…' : 'Record' }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!items.length" class="card space-y-3" aria-busy="true">
      <div class="skeleton h-6 w-1/2"></div>
      <div v-for="i in 5" :key="i" class="skeleton h-10 w-full"></div>
    </div>
  </div>
</template>
