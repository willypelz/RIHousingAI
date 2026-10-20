import { Router } from 'express';
import { insert, where, all, getById, updateById, now, indexBy, sortBy } from '../db/firestore.js';
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
  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const pas = indexBy(await where('project_approvals', 'project_id', projectId));
  const types = indexBy(await all('approval_types'));
  const items = (await where('checklist_items', 'project_id', projectId))
    .filter(ci => pas[ci.project_approval_id]?.applicability !== 'not_applicable')
    .map(ci => ({ ...ci, approval_name: types[pas[ci.project_approval_id]?.approval_type_id]?.name ?? '' }));

  const documents = await where('documents', 'project_id', projectId);
  const versions = await where('document_versions', 'project_id', projectId);
  const docs = documents.map(d => {
    const latest = sortBy(versions.filter(v => v.document_id === d.id), 'version', 'desc')[0];
    return latest ? {
      document_id: d.id, title: d.title, category: d.category, checklist_item_id: d.checklist_item_id,
      version_id: latest.id, original_name: latest.original_name, extracted_text: latest.extracted_text,
    } : null;
  }).filter(Boolean) as any[];

  const findings: Finding[] = [];

  // Rule-based pass (always runs)
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

  const check = await insert('completeness_checks', {
    project_id: projectId, run_by: req.user!.id, engine, disclaimer: DISCLAIMER, created_at: now(),
  });
  const stored = [];
  for (const f of findings) {
    stored.push(await insert('completeness_findings', {
      check_id: check.id, project_id: projectId,
      finding_type: f.finding_type, severity: f.severity, title: f.title,
      detail: f.detail ?? null, evidence: f.evidence ?? null,
      document_version_id: f.document_version_id ?? null,
      checklist_item_id: f.checklist_item_id ?? null, resolved: false,
    }));
  }
  await audit(req.user!.id, 'completeness.run', 'completeness_check', check.id, { findings: findings.length, engine });
  res.status(201).json({ check, findings: stored });
});

completenessRouter.get('/:projectId/completeness-checks', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const checks = sortBy(await where('completeness_checks', 'project_id', projectId), 'created_at', 'desc').slice(0, 10);
  const findings = await where('completeness_findings', 'project_id', projectId);
  res.json({
    checks: checks.map(c => ({
      ...c, findings: sortBy(findings.filter(f => f.check_id === c.id), 'id'),
    })),
  });
});

completenessRouter.patch('/:projectId/findings/:findingId', requireProjectAccess(), async (req, res) => {
  const { resolved } = req.body || {};
  const f = await getById('completeness_findings', req.params.findingId);
  if (!f || f.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  res.json({ finding: await updateById('completeness_findings', f.id, { resolved: !!resolved }) });
});
