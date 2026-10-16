import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** Downloadable project status report (self-contained HTML, printable to PDF). */
reportsRouter.get('/:projectId/report', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = (await query(
    `SELECT p.*, m.name AS municipality_name FROM projects p JOIN municipalities m ON m.id=p.municipality_id WHERE p.id=$1`,
    [projectId])).rows[0];
  if (!p) return res.status(404).json({ error: 'Project not found' });

  const approvals = (await query(
    `SELECT at.name, pa.applicability, pa.applicability_note, pa.status, a.name AS agency, a.department,
            s.url AS source_url, s.last_verified_at
     FROM project_approvals pa JOIN approval_types at ON at.id=pa.approval_type_id
     LEFT JOIN agencies a ON a.id=at.agency_id
     LEFT JOIN official_sources s ON s.id=at.source_id
     WHERE pa.project_id=$1 ORDER BY at.id`, [projectId])).rows;

  const checklist = (await query(
    `SELECT ci.title, ci.status, ci.item_type, at.name AS approval FROM checklist_items ci
     JOIN project_approvals pa ON pa.id=ci.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id WHERE pa.project_id=$1 ORDER BY at.id, ci.sort_order`, [projectId])).rows;

  const stages = (await query(
    `SELECT rs.name, rs.status, rs.responsible_authority, rs.submitted_at, at.name AS approval
     FROM review_stages rs JOIN project_approvals pa ON pa.id=rs.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id WHERE pa.project_id=$1 ORDER BY pa.id, rs.sort_order`, [projectId])).rows;

  const openComments = (await query(
    `SELECT rc.comment_type, rc.body, rc.status, rc.created_at FROM review_comments rc
     JOIN project_approvals pa ON pa.id=rc.project_approval_id WHERE pa.project_id=$1 AND rc.status!='resolved'`, [projectId])).rows;

  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const badge = (s: string) => `<span class="badge b-${esc(s)}">${esc(s).replace(/_/g, ' ')}</span>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Status Report — ${esc(p.name)}</title>
<style>
body{font-family:-apple-system,Segoe UI,sans-serif;max-width:900px;margin:2rem auto;color:#1a202c;padding:0 1rem}
h1{font-size:1.5rem} h2{font-size:1.1rem;margin-top:2rem;border-bottom:2px solid #e2e8f0;padding-bottom:.3rem}
table{width:100%;border-collapse:collapse;font-size:.85rem} td,th{border:1px solid #e2e8f0;padding:.4rem .6rem;text-align:left;vertical-align:top}
th{background:#f7fafc} .badge{padding:.1rem .45rem;border-radius:9999px;font-size:.72rem;background:#edf2f7}
.b-complete,.b-approved{background:#c6f6d5}.b-active,.b-in_progress{background:#bee3f8}.b-waiting_on_agency{background:#feebc8}
.muted{color:#718096;font-size:.8rem}.disclaimer{background:#fffbea;border:1px solid #f6e05e;padding: .6rem 1rem;border-radius:6px;font-size:.82rem;margin-top:1.5rem}
</style></head><body>
<h1>RIHousingAI — Project Status Report</h1>
<p class="muted">Generated ${new Date().toISOString().slice(0, 10)}</p>
<h2>Project</h2>
<table><tr><th>Name</th><td>${esc(p.name)}</td></tr>
<tr><th>Address</th><td>${esc(p.address)}, ${esc(p.municipality_name)}, RI</td></tr>
<tr><th>Development</th><td>${esc(p.units)} units — ${esc(p.dev_type)} (${esc(p.construction_kind).replace(/_/g, ' ')})</td></tr>
<tr><th>Applicant</th><td>${esc(p.applicant_name)}${p.representative_name ? ' / Rep: ' + esc(p.representative_name) : ''}</td></tr>
<tr><th>Status</th><td>${badge(p.status)}</td></tr></table>
<h2>Approval Pathway</h2>
<table><tr><th>Approval</th><th>Applicability</th><th>Status</th><th>Authority</th><th>Source</th></tr>
${approvals.map(a => `<tr><td>${esc(a.name)}${a.applicability_note ? `<div class="muted">${esc(a.applicability_note)}</div>` : ''}</td><td>${badge(a.applicability)}</td><td>${badge(a.status)}</td><td>${esc(a.agency)}${a.department ? ' — ' + esc(a.department) : ''}</td><td>${a.source_url ? `<a href="${esc(a.source_url)}">link</a> <span class="muted">(verified ${esc(a.last_verified_at)})</span>` : ''}</td></tr>`).join('')}
</table>
<h2>Checklist (${checklist.filter(c => c.status === 'complete').length}/${checklist.length} complete)</h2>
<table><tr><th>Item</th><th>Type</th><th>Approval</th><th>Status</th></tr>
${checklist.map(c => `<tr><td>${esc(c.title)}</td><td>${esc(c.item_type)}</td><td>${esc(c.approval)}</td><td>${badge(c.status)}</td></tr>`).join('')}
</table>
<h2>Review Stages</h2>
<table><tr><th>Stage</th><th>Approval</th><th>Status</th><th>Authority</th><th>Submitted</th></tr>
${stages.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.approval)}</td><td>${badge(s.status)}</td><td>${esc(s.responsible_authority)}</td><td>${s.submitted_at ? esc(String(s.submitted_at).slice(0, 10)) : '—'}</td></tr>`).join('')}
</table>
${openComments.length ? `<h2>Open Agency Feedback</h2><table><tr><th>Type</th><th>Comment</th><th>Status</th></tr>
${openComments.map(c => `<tr><td>${esc(c.comment_type)}</td><td>${esc(c.body)}</td><td>${badge(c.status)}</td></tr>`).join('')}</table>` : ''}
<div class="disclaimer"><strong>Important:</strong> This report reflects information recorded in RIHousingAI. It is not an official determination. Only the responsible authorities can confirm application completeness, deadlines, and approval status. Verify all requirements and fees with the agencies cited above.</div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="status-report-project-${projectId}.html"`);
  res.send(html);
});
