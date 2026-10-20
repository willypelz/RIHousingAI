<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ projectId: number }>();
const data = ref<any>(null);
const err = ref('');
const saving = ref(false);
const saved = ref(false);

const language = ref('en');
const translating = ref(false);
const translated = ref<Record<string, string>>({});
const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }, { code: 'pt', name: 'Português' },
  { code: 'kea', name: 'Kriolu' }, { code: 'ht', name: 'Kreyòl' }, { code: 'km', name: 'ខ្មែរ' },
];

const totalCost = ref<number | null>(null);
// selected: code -> user-entered planning amount
const selected = ref<Record<string, number>>({});
const otherLabel = ref('');
const otherAmount = ref<number>(0);

async function load() {
  const d = await api.get(`/projects/${props.projectId}/funding`);
  data.value = d;
  totalCost.value = d.stack.total_cost;
  selected.value = {};
  for (const s of d.stack.sources || []) {
    if (s.code === 'other') { otherLabel.value = s.label || ''; otherAmount.value = s.amount; }
    else selected.value[s.code] = s.amount;
  }
}

const committed = computed(() =>
  Object.values(selected.value).reduce((a, b) => a + (b || 0), 0) + (otherAmount.value || 0));
const gap = computed(() => (totalCost.value ?? 0) - committed.value);
const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function toggle(code: string) {
  if (code in selected.value) delete selected.value[code];
  else selected.value[code] = 0;
}

async function save() {
  saving.value = true; err.value = ''; saved.value = false;
  try {
    const sources = Object.entries(selected.value).map(([code, amount]) => ({ code, amount }));
    if (otherLabel.value || otherAmount.value) sources.push({ code: 'other', label: otherLabel.value, amount: otherAmount.value } as any);
    await api.patch(`/projects/${props.projectId}/funding`, { total_cost: totalCost.value, sources });
    saved.value = true;
    setTimeout(() => (saved.value = false), 2500);
  } catch (e: any) { err.value = e.message; }
  finally { saving.value = false; }
}

const translatableTexts = computed(() => {
  if (!data.value) return [];
  const t: string[] = [data.value.disclaimer];
  for (const p of data.value.programs) t.push(p.summary, p.who_can_apply, p.amount_note, p.deadline_note);
  return t;
});

async function setLanguage(code: string) {
  language.value = code;
  translated.value = {};
  if (code === 'en' || !data.value) return;
  translating.value = true; err.value = '';
  try {
    const texts = translatableTexts.value;
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += 80) {
      const { translations } = await api.post(`/projects/${props.projectId}/zoning/translate`, { language: code, texts: texts.slice(i, i + 80) });
      out.push(...translations);
    }
    const map: Record<string, string> = {};
    texts.forEach((orig, i) => { map[orig] = out[i]; });
    translated.value = map;
  } catch (e: any) { err.value = e.message; }
  finally { translating.value = false; }
}
const tr = (text: string | null | undefined) => (text && translated.value[text]) || text || '';

onMounted(load);
</script>

<template>
  <div v-if="data" class="space-y-5">
    <!-- Language picker -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="section-title">Language</span>
      <button v-for="l in LANGUAGES" :key="l.code" @click="setLanguage(l.code)"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="language === l.code ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'">
        {{ l.name }}
      </button>
      <span v-if="translating" class="text-xs italic text-slate-500">Translating…</span>
    </div>
    <p v-if="err" role="alert" class="rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">{{ err }}</p>

    <p class="flex items-start gap-2 text-xs text-slate-500">
      <AppIcon name="info" :size="14" class="mt-0.5 shrink-0 text-amber-500" /> {{ tr(data.disclaimer) }}
    </p>

    <!-- Gap calculator -->
    <div class="card !ring-brand-500/25">
      <h2 class="mb-1 text-[1.05rem] font-bold text-slate-900">Funding gap calculator</h2>
      <p class="mb-4 text-xs text-slate-500">Your own planning figures — select programs below and enter the amounts you plan to request.</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" for="f-total">Total project cost</label>
          <input id="f-total" v-model.number="totalCost" type="number" min="0" class="input" placeholder="e.g. 5000000" />
        </div>
        <div class="stat-card !p-4 !shadow-none !ring-slate-200">
          <span class="stat-icon bg-brand-50 text-brand-600"><AppIcon name="currency" :size="20" /></span>
          <div><p class="stat-value text-lg">{{ fmt(committed) }}</p><p class="stat-label">Selected sources</p></div>
        </div>
        <div class="stat-card !p-4 !shadow-none" :class="gap > 0 ? '!ring-amber-300 !bg-amber-50/50' : '!ring-emerald-300 !bg-emerald-50/50'">
          <span class="stat-icon" :class="gap > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'"><AppIcon :name="gap > 0 ? 'info' : 'check'" :size="20" /></span>
          <div><p class="stat-value text-lg" :class="gap > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ fmt(Math.abs(gap)) }}</p>
            <p class="stat-label">{{ gap > 0 ? 'Remaining gap' : gap < 0 ? 'Over-committed' : 'Fully stacked' }}</p></div>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        <div class="min-w-48 flex-1">
          <label class="label" for="f-other">Other source (bank debt, deferred fee, …)</label>
          <input id="f-other" v-model="otherLabel" class="input" placeholder="e.g. Construction loan" />
        </div>
        <div>
          <label class="label" for="f-other-amt">Amount</label>
          <input id="f-other-amt" v-model.number="otherAmount" type="number" min="0" class="input !w-36" placeholder="0" />
        </div>
        <button class="btn" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save stack' }}</button>
      </div>
      <p v-if="saved" class="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><AppIcon name="check" :size="13" /> Funding stack saved.</p>
    </div>

    <!-- Programs -->
    <div v-for="p in data.programs" :key="p.code" class="card !p-5"
      :class="p.code in selected ? '!ring-brand-500/40' : ''">
      <div class="flex flex-wrap items-start gap-3">
        <input type="checkbox" class="mt-1" :checked="p.code in selected" @change="toggle(p.code)"
          :aria-label="`Include ${p.name} in funding stack`" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-bold text-slate-900">{{ p.name }}</h3>
            <span class="badge bg-slate-100 text-slate-600">{{ p.administrator }}</span>
            <a :href="p.url" target="_blank" class="link inline-flex items-center gap-1 text-xs">source <AppIcon name="external" :size="11" /></a>
          </div>
          <p class="mt-1 text-sm leading-relaxed text-slate-600">{{ tr(p.summary) }}</p>
          <dl class="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div><dt class="font-semibold text-slate-500">Who can apply</dt><dd class="text-slate-600">{{ tr(p.who_can_apply) }}</dd></div>
            <div><dt class="font-semibold text-slate-500">Roughly how much</dt><dd class="text-slate-600">{{ tr(p.amount_note) }}</dd></div>
            <div><dt class="font-semibold text-slate-500">Next deadline</dt><dd class="text-slate-600">{{ tr(p.deadline_note) }}</dd></div>
          </dl>
          <div v-if="p.code in selected" class="mt-3 flex items-center gap-2">
            <label :for="`amt-${p.code}`" class="text-xs font-semibold text-slate-600">Planned request:</label>
            <input :id="`amt-${p.code}`" v-model.number="selected[p.code]" type="number" min="0" class="input !w-44 !py-1.5" placeholder="0" />
          </div>
        </div>
      </div>
    </div>
    <p class="hint">Program links checked {{ data.links_checked }}. Record the date you verify each source.</p>
  </div>
  <div v-else class="space-y-4" aria-busy="true" aria-label="Loading funding programs">
    <div class="card space-y-3"><div class="skeleton h-5 w-1/3"></div><div class="grid gap-3 sm:grid-cols-3"><div class="skeleton h-16"></div><div class="skeleton h-16"></div><div class="skeleton h-16"></div></div></div>
    <div v-for="i in 3" :key="i" class="card space-y-2"><div class="skeleton h-5 w-1/2"></div><div class="skeleton h-4 w-full"></div></div>
  </div>
</template>
