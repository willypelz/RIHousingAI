import { Router } from 'express';
import { where, all, getById, updateById, indexBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

export const workflowRouter = Router();
workflowRouter.use(requireAuth);

const STAGE_STATUSES = ['pending','active','waiting_on_agency','waiting_on_applicant','complete','skipped'];

/** Update a review stage (status, dates, next action). Due dates require a source. */
workflowRouter.patch('/:projectId/stages/:stageId', requireProjectAccess(), async (req, res) => {
  const { status, submitted_at, verified_due_date, due_date_source_id, next_action } = req.body || {};
  if (status && !STAGE_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (verified_due_date && !due_date_source_id) {
    return res.status(400).json({ error: 'A verified due date requires a due_date_source_id citing the official source that establishes it.' });
  }

  const projectId = Number(req.params.projectId);
  const stage = await getById('review_stages', req.params.stageId);
  if (!stage || stage.project_id !== projectId) return res.status(404).json({ error: 'Stage not found' });

  // Block completing a stage whose dependencies are not complete
  if (status === 'complete' && (stage.depends_on || []).length) {
    const deps = await Promise.all(stage.depends_on.map((id: number) => getById('review_stages', id)));
    const unmet = deps.filter(d => d && !['complete', 'skipped'].includes(d.status));
    if (unmet.length) {
      return res.status(409).json({ error: `Cannot complete: depends on incomplete stage(s): ${unmet.map(d => d!.name).join(', ')}` });
    }
  }

  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (submitted_at !== undefined) updates.submitted_at = submitted_at;
  if (verified_due_date !== undefined) { updates.verified_due_date = verified_due_date; updates.due_date_source_id = due_date_source_id ?? null; }
  if (next_action !== undefined) updates.next_action = next_action;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });

  const updated = await updateById('review_stages', stage.id, updates);

  // Auto-activate dependent stages whose dependencies are now all complete
  if (status === 'complete') {
    const projectStages = await where('review_stages', 'project_id', projectId);
    const byId = indexBy(projectStages);
    for (const s of projectStages) {
      if (s.status !== 'pending' || !(s.depends_on || []).includes(stage.id)) continue;
      const allMet = (s.depends_on || []).every((id: number) => {
        const dep = id === stage.id ? { ...byId[id], status: 'complete' } : byId[id];
        return dep && ['complete', 'skipped'].includes(dep.status);
      });
      if (allMet) await updateById('review_stages', s.id, { status: 'active' });
    }
  }

  await audit(req.user!.id, 'stage.update', 'review_stage', stage.id, req.body);
  res.json({ stage: updated });
});

/** Dated events for the timeline/calendar. Only real recorded dates are returned:
 *  submissions, verified due dates (source-cited), decisions, scheduled inspections,
 *  and task due dates. The platform never invents dates. */
workflowRouter.get('/:projectId/timeline', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const pas = await where('project_approvals', 'project_id', projectId);
  const types = indexBy(await all('approval_types'));
  const approvalName = (paId: number) => {
    const pa = pas.find(x => x.id === paId);
    return pa ? types[pa.approval_type_id]?.name ?? null : null;
  };

  const events: any[] = [];
  events.push({ date: String(project.created_at).slice(0, 10), type: 'created', title: 'Project registered', detail: project.name });

  for (const s of await where('review_stages', 'project_id', projectId)) {
    if (s.submitted_at) events.push({ date: String(s.submitted_at).slice(0, 10), type: 'submitted', title: `${s.name} submitted`, detail: approvalName(s.project_approval_id), status: s.status });
    if (s.verified_due_date) events.push({ date: String(s.verified_due_date).slice(0, 10), type: 'due', title: `${s.name} due (verified)`, detail: approvalName(s.project_approval_id), status: s.status });
  }
  for (const d of await where('decisions', 'project_id', projectId)) {
    events.push({ date: String(d.decided_on).slice(0, 10), type: 'decision', title: `Decision: ${String(d.decision).replace(/_/g, ' ')}`, detail: `${approvalName(d.project_approval_id) ?? ''} — ${d.decided_by}` });
  }
  for (const i of await where('inspections', 'project_id', projectId)) {
    if (i.scheduled_for) events.push({ date: String(i.scheduled_for).slice(0, 10), type: 'inspection', title: `Inspection: ${i.name}`, detail: i.inspector_agency, status: i.result });
  }
  for (const t of await where('tasks', 'project_id', projectId)) {
    if (t.verified_due_date && t.status === 'open') events.push({ date: String(t.verified_due_date).slice(0, 10), type: 'task', title: `Task due: ${t.title}`, detail: `Waiting on ${t.waiting_on}` });
  }

  // Checklist items with the applicant's own planning target date (never official deadlines).
  // "missed" = target passed while the item is still open.
  const todayStr = new Date().toISOString().slice(0, 10);
  for (const ci of await where('checklist_items', 'project_id', projectId)) {
    if (!ci.target_date) continue;
    const open = !['complete', 'not_applicable'].includes(ci.status);
    events.push({
      date: String(ci.target_date).slice(0, 10), type: 'checklist',
      title: ci.title, detail: `Your target · ${approvalName(ci.project_approval_id) ?? ''}`,
      status: ci.status, missed: open && String(ci.target_date).slice(0, 10) < todayStr,
    });
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  res.json({ events, today: todayStr });
});

/** Progress & delay overview. Never labels anything overdue without a verified deadline. */
workflowRouter.get('/:projectId/progress', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const todayStr = new Date().toISOString().slice(0, 10);

  const pas = (await where('project_approvals', 'project_id', projectId)).filter(pa => pa.applicability !== 'not_applicable');
  const types = indexBy(await all('approval_types'));
  const sources = indexBy(await all('official_sources'));
  const stages = await where('review_stages', 'project_id', projectId);
  const checklistItems = await where('checklist_items', 'project_id', projectId);
  const tasks = (await where('tasks', 'project_id', projectId)).filter(t => t.status === 'open');

  const approvals = pas.map(pa => {
    const t = types[pa.approval_type_id] || {};
    const s = sources[t.source_id] || {};
    const paStages = stages.filter(st => st.project_approval_id === pa.id);
    const submissions = paStages.map(st => st.submitted_at).filter(Boolean).sort();
    return {
      id: pa.id, name: t.name, code: t.code, applicability: pa.applicability, status: pa.status,
      submitted_at: pa.submitted_at, verified_due_date: pa.verified_due_date,
      stages_done: String(paStages.filter(st => ['complete', 'skipped'].includes(st.status)).length),
      stages_total: String(paStages.length),
      first_submission: submissions[0] ?? null,
      processing_estimate: s.processing_estimate ?? null,
      _order: pa.approval_type_id,
    };
  }).sort((a, b) => a._order - b._order);

  const checklist = {
    done: String(checklistItems.filter(c => c.status === 'complete').length),
    outstanding: String(checklistItems.filter(c => !['complete', 'not_applicable'].includes(c.status)).length),
  };

  const daysBetween = (from: string, to: string) =>
    Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

  const waiting = stages
    .filter(s => ['active', 'waiting_on_agency', 'waiting_on_applicant'].includes(s.status))
    .map(s => {
      const pa = pas.find(x => x.id === s.project_approval_id);
      const t = pa ? types[pa.approval_type_id] : null;
      return {
        id: s.id, name: s.name, status: s.status, responsible_authority: s.responsible_authority,
        submitted_at: s.submitted_at, approval_name: t?.name ?? null,
        days_elapsed: s.submitted_at ? daysBetween(s.submitted_at, todayStr) : null,
        verified_due_date: s.verified_due_date,
        past_verified_due_date: !!(s.verified_due_date && todayStr > s.verified_due_date),
      };
    })
    .sort((a, b) => (a.submitted_at ?? '9999') < (b.submitted_at ?? '9999') ? -1 : 1);

  const bottlenecks = waiting
    .filter(w => w.status === 'waiting_on_agency')
    .map(w => ({
      stage: w.name, approval: w.approval_name, days_elapsed: w.days_elapsed,
      recommendation: w.past_verified_due_date
        ? 'The verified review deadline has passed — follow up with the responsible authority.'
        : 'Awaiting agency review. Consider a status inquiry with the responsible authority; no verified deadline has been exceeded.',
    }));

  res.json({ approvals, checklist, waiting, tasks, bottlenecks });
});
