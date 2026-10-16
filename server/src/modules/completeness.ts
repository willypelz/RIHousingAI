import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { getProvider, aiAvailable } from '../ai/provider.js';

export const completenessRouter = Router();
completenessRouter.use(requireAuth);

const DISCLAIMER = 'This automated check identifies potential gaps based on the official checklist and uploaded documents. Only the responsible authority can determine whether an application is officially complete.';

interface Finding {
  finding_type: 'missing_document'|'incomplete_field'|'missing_signature'|'inconsistency'|'missing_attachment'|'open_question';
  severity: 'info'|'warning'|'blocker';
  title: string;
  detail: string;
  evidence: string;
  checklist_item_id?: number | null;
  document_version_id?: number | null;
}

completenessRouter.post('/:projectId/completeness-checks', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = (await query(`SELECT * FROM projects WHERE id=$1`, [projectId])).rows[0];
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const items = (await query(
    `SELECT ci.id, ci.title, ci.item_type, ci.status, ci.description, at.name AS approval_name
     FROM checklist_items ci
     JOIN project_approvals pa ON pa.id=ci.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 AND pa.applicability != 'not_applicable'`, [projectId])).rows;

  const docs = (await query(
    `SELECT d.id AS document_id, d.title, d.category, d.checklist_item_id,
            v.id AS version_id, v.original_name, v.extracted_text
     FROM documents d
     JOIN LATERAL (SELECT * FROM document_versions v WHERE v.document_id=d.id ORDER BY version DESC LIMIT 1) v ON true
     WHERE d.project_id=$1`, [projectId])).rows;

  const findings: Finding[] = [];

  // Rule-based pass (always runs): checklist items of document/plan/form type with no linked upload and not complete
  for (const item of items) {
    if (!['document','plan','form','certification'].includes(item.item_type)) continue;
    if (item.status === 'complete' || item.status === 'not_applicable') continue;
    const linked = docs.find(d => d.checklist_item_id === item.id);
    if (!linked) {
      findings.push({
        finding_type: 'missing_document', severity: 'warning',
        title: `No document uploaded for: ${item.title}`,
        detail: `Checklist item "${item.title}" (${item.approval_name}) is ${item.status} and has no linked upload.`,
        evidence: `Official checklist requires: ${item.description ?? item.title}`,
        checklist_item_id: item.id,
      });
    }
  }

  // Text heuristics on extracted content
  for (const d of docs) {
    const text = (d.extracted_text || '').toLowerCase();
    if (!text) continue;
    if ((d.category === 'application_form' || /application/.test(d.title.toLowerCase())) && !/sign(ature|ed)/.test(text)) {
      findings.push({
        finding_type: 'missing_signature', severity: 'warning',
        title: `Possible missing signature: ${d.original_name}`,
        detail: 'No signature-related text was detected in this application document. Verify it is signed before submission.',
        evidence: 'Extracted text contains no occurrence of "signature"/"signed".',
        document_version_id: d.version_id,
      });
    }
    // Project info consistency: units count mentioned in documents vs registered
    const unitMatches = text.match(/(\d+)\s*(dwelling\s+)?units?/);
    if (unitMatches && Number(unitMatches[1]) !== project.units && Number(unitMatches[1]) > 0) {
      findings.push({
        finding_type: 'inconsistency', severity: 'warning',
        title: `Unit count mismatch in ${d.original_name}`,
        detail: `Document mentions ${unitMatches[1]} units but the project is registered with ${project.units} units.`,
        evidence: `Excerpt: "...${unitMatches[0]}..." vs registered units: ${project.units}.`,
        document_version_id: d.version_id,
      });
    }
  }

  let engine = 'fallback';
  // AI pass: deeper review of extracted document text against the checklist
  if (aiAvailable() && docs.some(d => d.extracted_text)) {
    try {
      const docSummaries = docs.filter(d => d.extracted_text).map(d =>
        `[DOC v${d.version_id}] "${d.original_name}" (category: ${d.category})\n${(d.extracted_text as string).slice(0, 4000)}`).join('\n\n');
      const checklistText = items.map(i => `- [item ${i.id}] ${i.title} (${i.item_type}, status: ${i.status}) — ${i.approval_name}`).join('\n');
      const raw = await getProvider().complete(
        `You review housing development application documents for completeness against an official checklist. Respond ONLY with a JSON array of findings, each: {"finding_type":"missing_document|incomplete_field|missing_signature|inconsistency|missing_attachment|open_question","severity":"info|warning|blocker","title":"...","detail":"...","evidence":"verbatim excerpt or explicit basis","checklist_item_id":<number or null>,"document_version_id":<number or null>}. Every finding MUST include concrete evidence. Never state the application is complete — only the authority can determine completeness. If nothing is found, return [].`,
        `Project: ${project.name}, ${project.address}, ${project.units} units, ${project.dev_type}, ${project.construction_kind}.\n\nOfficial checklist:\n${checklistText}\n\nUploaded documents (latest versions, extracted text):\n${docSummaries}`,
        3000);
      const jsonStart = raw.indexOf('[');
      const jsonEnd = raw.lastIndexOf(']');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const aiFindings = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Finding[];
        for (const f of aiFindings) {
          if (f.title && f.finding_type && f.evidence) findings.push({ ...f, severity: f.severity || 'warning' });
        }
        engine = 'anthropic';
      }
    } catch (e) {
      console.error('AI completeness pass failed, using rule-based findings only:', (e as Error).message);
    }
  }

  const check = (await query(
    `INSERT INTO completeness_checks (project_id, run_by, engine, disclaimer) VALUES ($1,$2,$3,$4) RETURNING *`,
    [projectId, req.user!.id, engine, DISCLAIMER])).rows[0];
  for (const f of findings) {
    await query(
      `INSERT INTO completeness_findings (check_id, finding_type, severity, title, detail, evidence, document_version_id, checklist_item_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [check.id, f.finding_type, f.severity, f.title, f.detail ?? null, f.evidence ?? null, f.document_version_id ?? null, f.checklist_item_id ?? null]);
  }
  await audit(req.user!.id, 'completeness.run', 'completeness_check', check.id, { findings: findings.length, engine });

  const stored = (await query(`SELECT * FROM completeness_findings WHERE check_id=$1 ORDER BY severity DESC, id`, [check.id])).rows;
  res.status(201).json({ check, findings: stored });
});

completenessRouter.get('/:projectId/completeness-checks', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT cc.*, (SELECT json_agg(f.* ORDER BY f.id) FROM completeness_findings f WHERE f.check_id=cc.id) AS findings
     FROM completeness_checks cc WHERE cc.project_id=$1 ORDER BY cc.created_at DESC LIMIT 10`, [req.params.projectId]);
  res.json({ checks: rows });
});

completenessRouter.patch('/:projectId/findings/:findingId', requireProjectAccess(), async (req, res) => {
  const { resolved } = req.body || {};
  const { rows } = await query(
    `UPDATE completeness_findings f SET resolved=$1
     FROM completeness_checks cc WHERE f.id=$2 AND cc.id=f.check_id AND cc.project_id=$3 RETURNING f.*`,
    [!!resolved, req.params.findingId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ finding: rows[0] });
});
