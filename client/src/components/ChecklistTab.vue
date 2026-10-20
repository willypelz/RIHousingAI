<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number }>();
const items = ref<any[]>([]);
const approvals = ref<Record<string, any>>({});
const printLanguage = ref('en');
const printing = ref(false);
const err = ref('');

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'pt', name: 'Português' },
  { code: 'kea', name: 'Kriolu' }, { code: 'ht', name: 'Kreyòl' }, { code: 'km', name: 'ខ្មែរ' },
];

const grouped = computed(() => {
  const g: Record<string, any[]> = {};
  for (const i of items.value) (g[i.approval_name] ||= []).push(i);
  return g;
});

const TYPE_ICONS: Record<string, string> = {
  form: 'document', document: 'paperclip', plan: 'map', certification: 'pencil', fee: 'currency',
  instruction: 'info', prerequisite: 'link', referral: 'arrow-right', hearing: 'scale',
};

async function load() {
  const [cl, pw] = await Promise.all([
    api.get(`/projects/${props.projectId}/checklist`),
    api.get(`/projects/${props.projectId}/pathway`),
  ]);
  items.value = cl.items;
  // Per-approval contact + published timeline for group headers and the printout
  const map: Record<string, any> = {};
  for (const a of pw.approvals) {
    map[a.name] = {
      contact: [a.agency_name, a.agency_department].filter(Boolean).join(' — ') || 'Confirm with the town',
      phone: a.agency_phone, website: a.agency_website,
      estimate: a.processing_estimate,
      confirm: a.applicability === 'conditional' || !a.agency_name,
    };
  }
  approvals.value = map;
}

async function setStatus(item: any, status: string) {
  await api.patch(`/projects/${props.projectId}/checklist/${item.id}`, { status });
  await load();
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One-page printable checklist. If a non-English language is selected, item titles and
 *  labels are translated via the existing translate endpoint (names/links preserved). */
async function printChecklist() {
  printing.value = true; err.value = '';
  try {
    const labels = ['Approvals checklist', 'Generated', 'Contact', 'Published timeline', 'Confirm with the town',
      'done', 'This is a working checklist from official sources, not an official determination. Confirm requirements, fees, and timelines with the responsible authorities.'];
    let texts = [...labels, ...Object.keys(grouped.value), ...items.value.map(i => i.title)];
    if (printLanguage.value !== 'en') {
      const { translations } = await api.post(`/projects/${props.projectId}/zoning/translate`, { language: printLanguage.value, texts: texts.slice(0, 80) });
      const extra = texts.length > 80
        ? (await api.post(`/projects/${props.projectId}/zoning/translate`, { language: printLanguage.value, texts: texts.slice(80) })).translations
        : [];
      texts = [...translations, ...extra];
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="hint max-w-md">Each item cites its official source. Fees are never estimated — confirm with the cited authority.</p>
      <div class="flex items-center gap-1.5">
        <label class="sr-only" for="cl-lang">Printout language</label>
        <select id="cl-lang" v-model="printLanguage" class="input !w-auto !py-2 text-xs">
          <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.name }}</option>
        </select>
        <button class="btn-secondary" :disabled="printing" @click="printChecklist">
          <AppIcon name="printer" :size="15" /> {{ printing ? 'Preparing…' : 'Print one-page summary' }}
        </button>
      </div>
    </div>
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>
    <div v-for="(group, approval) in grouped" :key="approval" class="card">
      <div class="mb-3">
        <h2 class="text-[1.05rem] font-bold text-slate-900">{{ approval }}
          <span class="ml-2 text-xs font-normal text-slate-500">{{ group.filter(i => i.status === 'complete').length }}/{{ group.length }} complete</span>
        </h2>
        <p v-if="approvals[approval]" class="mt-0.5 text-xs text-slate-500">
          {{ approvals[approval].contact }}<span v-if="approvals[approval].phone"> · {{ approvals[approval].phone }}</span>
          <span v-if="approvals[approval].confirm" class="ml-1 font-medium text-amber-600">· confirm with the town</span>
        </p>
        <p v-if="approvals[approval]?.estimate" class="mt-0.5 text-xs text-slate-500">Published timeline: {{ approvals[approval].estimate }}</p>
        <div class="progress-track mt-2"><div class="progress-fill" :style="{ width: `${(group.filter(i => i.status === 'complete').length / group.length) * 100}%` }"></div></div>
      </div>
      <div v-for="item in group" :key="item.id" class="flex flex-wrap items-start gap-3 border-b border-slate-100 py-2 last:border-0 sm:flex-nowrap">
        <input type="checkbox" class="mt-1" :checked="item.status === 'complete'"
          @change="setStatus(item, ($event.target as HTMLInputElement).checked ? 'complete' : 'pending')" />
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-1.5 text-sm font-medium" :class="item.status === 'complete' ? 'text-slate-500 line-through' : 'text-slate-700'">
            <AppIcon :name="TYPE_ICONS[item.item_type] || 'info'" :size="14" class="text-slate-500" /> {{ item.title }}
          </p>
          <p class="text-xs text-slate-500">{{ item.description }}</p>
          <p class="mt-0.5 text-[11px] text-slate-500">
            Responsible: {{ item.responsible_authority }}
            <template v-if="item.source_url"> · <a :href="item.source_url" target="_blank" class="link">source ↗</a> (verified {{ item.source_verified?.slice(0, 10) }})</template>
            <template v-if="item.submission_link"> · <a :href="item.submission_link" target="_blank" class="link">submit ↗</a></template>
          </p>
          <p v-if="item.item_type === 'fee' && item.fee_note" class="text-[11px] text-amber-700">Fee: {{ item.fee_note }}</p>
        </div>
        <select class="ml-6 shrink-0 rounded border border-slate-200 p-1 text-[11px] sm:ml-0" :value="item.status"
          @change="setStatus(item, ($event.target as HTMLSelectElement).value)">
          <option value="pending">pending</option><option value="in_progress">in progress</option>
          <option value="complete">complete</option><option value="not_applicable">n/a</option>
        </select>
      </div>
    </div>
  </div>
</template>
