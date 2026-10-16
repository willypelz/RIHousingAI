<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';

const props = defineProps<{ projectId: number }>();
const documents = ref<any[]>([]);
const checklist = ref<any[]>([]);
const file = ref<File | null>(null);
const title = ref('');
const checklistItemId = ref<string>('');
const versionTarget = ref<string>('');
const busy = ref(false);
const err = ref('');

async function load() {
  const [d, c] = await Promise.all([
    api.get(`/projects/${props.projectId}/documents`),
    api.get(`/projects/${props.projectId}/checklist`),
  ]);
  documents.value = d.documents; checklist.value = c.items;
}

function onFile(e: Event) { file.value = (e.target as HTMLInputElement).files?.[0] || null; }

async function upload() {
  if (!file.value) return;
  busy.value = true; err.value = '';
  try {
    const form = new FormData();
    form.append('file', file.value);
    if (title.value) form.append('title', title.value);
    if (versionTarget.value) form.append('document_id', versionTarget.value);
    else if (checklistItemId.value) form.append('checklist_item_id', checklistItemId.value);
    await api.upload(`/projects/${props.projectId}/documents`, form);
    file.value = null; title.value = ''; checklistItemId.value = ''; versionTarget.value = '';
    await load();
  } catch (e: any) { err.value = e.message; }
  finally { busy.value = false; }
}

function download(v: any) {
  api.download(`/projects/${props.projectId}/documents/versions/${v.id}/download`, v.original_name);
}
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Upload document</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label">File (pdf, docx, png, jpg, txt — 25MB max)</label>
          <input type="file" @change="onFile" class="input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" /></div>
        <div><label class="label">Title (optional)</label><input v-model="title" class="input" /></div>
        <div><label class="label">Link to checklist item (optional)</label>
          <select v-model="checklistItemId" class="input" :disabled="!!versionTarget">
            <option value="">— none —</option>
            <option v-for="i in checklist" :key="i.id" :value="i.id">{{ i.title }} ({{ i.approval_name }})</option>
          </select></div>
        <div><label class="label">Or new version of existing document</label>
          <select v-model="versionTarget" class="input">
            <option value="">— new document —</option>
            <option v-for="d in documents" :key="d.id" :value="d.id">{{ d.title }}</option>
          </select></div>
      </div>
      <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
      <button class="btn mt-3" :disabled="!file || busy" @click="upload">{{ busy ? 'Uploading…' : 'Upload' }}</button>
    </div>

    <div class="card">
      <h2 class="mb-3 font-semibold text-slate-800">Documents</h2>
      <p v-if="!documents.length" class="text-sm text-slate-400">No documents uploaded yet.</p>
      <div v-for="d in documents" :key="d.id" class="border-b border-slate-100 py-3 last:border-0">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-medium text-slate-700">{{ d.title }}</p>
          <span class="badge bg-slate-100 text-slate-600">{{ d.category.replace(/_/g, ' ') }}</span>
          <span v-if="d.checklist_item_title" class="badge bg-brand-50 text-brand-700">→ {{ d.checklist_item_title }}</span>
        </div>
        <div v-for="v in d.versions" :key="v.id" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span class="font-mono">v{{ v.version }}</span>
          <span>{{ v.original_name }}</span>
          <span>{{ (v.size_bytes / 1024).toFixed(0) }} KB</span>
          <span>{{ new Date(v.uploaded_at).toLocaleDateString() }} by {{ v.uploaded_by }}</span>
          <button class="text-brand-600 hover:underline" @click="download(v)">download</button>
        </div>
      </div>
    </div>
  </div>
</template>
