import { Router } from 'express';
import { where, all, getById, indexBy, sortBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { getProvider, aiAvailable } from '../ai/provider.js';
import { SUPPORTED_LANGUAGES } from './zoningData.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// Static report labels, translatable per request. Names, addresses, and links are never translated.
const LABELS = [
  'RIHousingAI — Project Status Report', 'Generated', 'Project', 'Name', 'Address', 'Development',
  'Applicant', 'Status', 'Approval Pathway', 'Approval', 'Applicability', 'Authority', 'Source',
  'Checklist', 'complete', 'Item', 'Type', 'Review Stages', 'Stage', 'Submitted',
  'Open Agency Feedback', 'Comment', 'units', 'link', 'verified', 'Important:',
  'This report reflects information recorded in RIHousingAI. It is not an official determination. Only the responsible authorities can confirm application completeness, deadlines, and approval status. Verify all requirements and fees with the agencies cited above.',
] as const;

const labelCache = new Map<string, Record<string, string>>();

async function reportLabels(language: string): Promise<Record<string, string>> {
  const identity = Object.fromEntries(LABELS.map(l => [l, l]));
  if (language === 'en' || !aiAvailable()) return identity;
  const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.name;
  if (!langName) return identity;
  if (labelCache.has(language)) return labelCache.get(language)!;
  try {
    const raw = await getProvider().complete(
      `Translate each item of this JSON array into ${langName}. Keep "RIHousingAI" as-is. Respond ONLY with a JSON array of the same length and order.`,
      JSON.stringify(LABELS), 2500);
    const arr = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
    if (Array.isArray(arr) && arr.length === LABELS.length) {
      const map = Object.fromEntries(LABELS.map((l, i) => [l, arr[i]]));
      labelCache.set(language, map);
      return map;
    }
  } catch (e) { console.error('Report label translation failed:', (e as Error).message); }
  return identity;
}

/** Downloadable project status report (self-contained HTML, printable to PDF).
 *  Pass ?language=es|pt|kea|ht|km for translated labels; names/addresses/links stay as-is. */
reportsRouter.get('/:projectId/report', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = await getById('projects', projectId);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const L = await reportLabels(String(req.query.language || 'en'));

  const munis = indexBy(await all('municipalities'));
  const types = indexBy(await all('approval_types'));
  const agencies = indexBy(await all('agencies'));
  const sources = indexBy(await all('official_sources'));
  const pas = sortBy(await where('project_approvals', 'project_id', projectId), 'approval_type_id');
  const pasById = indexBy(pas);
  const approvalName = (paId: number) => types[pasById[paId]?.approval_type_id]?.name ?? '';

  const approvals = pas.map(pa => {
    const t = types[pa.approval_type_id] || {};
    const a = agencies[t.agency_id] || {};
    const s = sources[t.source_id] || {};
    return {
      name: t.name, applicability: pa.applicability, applicability_note: pa.applicability_note,
      status: pa.status, agency: a.name, department: a.department,
      source_url: s.url, last_verified_at: s.last_verified_at,
    };
  });

  const checklist = (await where('checklist_items', 'project_id', projectId))
    .sort((a, b) => a.project_approval_id - b.project_approval_id || a.sort_order - b.sort_order)
    .map(c => ({ title: c.title, status: c.status, item_type: c.item_type, approval: approvalName(c.project_approval_id) }));

  const stages = (await where('review_stages', 'project_id', projectId))
    .sort((a, b) => a.project_approval_id - b.project_approval_id || a.sort_order - b.sort_order)
    .map(s => ({ name: s.name, status: s.status, responsible_authority: s.responsible_authority, submitted_at: s.submitted_at, approval: approvalName(s.project_approval_id) }));

  const openComments = (await where('review_comments', 'project_id', projectId))
    .filter(c => c.status !== 'resolved')
    .map(c => ({ comment_type: c.comment_type, body: c.body, status: c.status }));

  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const badge = (s: string) => `<span class="badge b-${esc(s)}">${esc(s).replace(/_/g, ' ')}</span>`;
  const municipality_name = munis[p.municipality_id]?.name ?? '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Status Report — ${esc(p.name)}</title>
<style>
body{font-family:-apple-system,Segoe UI,sans-serif;max-width:900px;margin:2rem auto;color:#1a202c;padding:0 1rem}
h1{font-size:1.5rem} h2{font-size:1.1rem;margin-top:2rem;border-bottom:2px solid #e2e8f0;padding-bottom:.3rem}
table{width:100%;border-collapse:collapse;font-size:.85rem} td,th{border:1px solid #e2e8f0;padding:.4rem .6rem;text-align:left;vertical-align:top}
th{background:#f7fafc} .badge{padding:.1rem .45rem;border-radius:9999px;font-size:.72rem;background:#edf2f7}
.b-complete,.b-approved{background:#c6f6d5}.b-active,.b-in_progress{background:#bee3f8}.b-waiting_on_agency{background:#feebc8}
.muted{color:#718096;font-size:.8rem}.disclaimer{background:#fffbea;border:1px solid #f6e05e;padding: .6rem 1rem;border-radius:6px;font-size:.82rem;margin-top:1.5rem}
</style></head><body>
<h1>${esc(L['RIHousingAI — Project Status Report'])}</h1>
<p class="muted">${esc(L['Generated'])} ${new Date().toISOString().slice(0, 10)}</p>
<h2>${esc(L['Project'])}</h2>
<table><tr><th>${esc(L['Name'])}</th><td>${esc(p.name)}</td></tr>
<tr><th>${esc(L['Address'])}</th><td>${esc(p.address)}, ${esc(municipality_name)}, RI</td></tr>
<tr><th>${esc(L['Development'])}</th><td>${esc(p.units)} ${esc(L['units'])} — ${esc(p.dev_type)} (${esc(p.construction_kind).replace(/_/g, ' ')})</td></tr>
<tr><th>${esc(L['Applicant'])}</th><td>${esc(p.applicant_name)}${p.representative_name ? ' / Rep: ' + esc(p.representative_name) : ''}</td></tr>
<tr><th>${esc(L['Status'])}</th><td>${badge(p.status)}</td></tr></table>
<h2>${esc(L['Approval Pathway'])}</h2>
<table><tr><th>${esc(L['Approval'])}</th><th>${esc(L['Applicability'])}</th><th>${esc(L['Status'])}</th><th>${esc(L['Authority'])}</th><th>${esc(L['Source'])}</th></tr>
${approvals.map(a => `<tr><td>${esc(a.name)}${a.applicability_note ? `<div class="muted">${esc(a.applicability_note)}</div>` : ''}</td><td>${badge(a.applicability)}</td><td>${badge(a.status)}</td><td>${esc(a.agency)}${a.department ? ' — ' + esc(a.department) : ''}</td><td>${a.source_url ? `<a href="${esc(a.source_url)}">${esc(L['link'])}</a> <span class="muted">(${esc(L['verified'])} ${esc(a.last_verified_at)})</span>` : ''}</td></tr>`).join('')}
</table>
<h2>${esc(L['Checklist'])} (${checklist.filter(c => c.status === 'complete').length}/${checklist.length} ${esc(L['complete'])})</h2>
<table><tr><th>${esc(L['Item'])}</th><th>${esc(L['Type'])}</th><th>${esc(L['Approval'])}</th><th>${esc(L['Status'])}</th></tr>
${checklist.map(c => `<tr><td>${esc(c.title)}</td><td>${esc(c.item_type)}</td><td>${esc(c.approval)}</td><td>${badge(c.status)}</td></tr>`).join('')}
</table>
<h2>${esc(L['Review Stages'])}</h2>
<table><tr><th>${esc(L['Stage'])}</th><th>${esc(L['Approval'])}</th><th>${esc(L['Status'])}</th><th>${esc(L['Authority'])}</th><th>${esc(L['Submitted'])}</th></tr>
${stages.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.approval)}</td><td>${badge(s.status)}</td><td>${esc(s.responsible_authority)}</td><td>${s.submitted_at ? esc(String(s.submitted_at).slice(0, 10)) : '—'}</td></tr>`).join('')}
</table>
${openComments.length ? `<h2>${esc(L['Open Agency Feedback'])}</h2><table><tr><th>${esc(L['Type'])}</th><th>${esc(L['Comment'])}</th><th>${esc(L['Status'])}</th></tr>
${openComments.map(c => `<tr><td>${esc(c.comment_type)}</td><td>${esc(c.body)}</td><td>${badge(c.status)}</td></tr>`).join('')}</table>` : ''}
<div class="disclaimer"><strong>${esc(L['Important:'])}</strong> ${esc(L['This report reflects information recorded in RIHousingAI. It is not an official determination. Only the responsible authorities can confirm application completeness, deadlines, and approval status. Verify all requirements and fees with the agencies cited above.'])}</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="status-report-project-${projectId}.html"`);
  res.send(html);
});
