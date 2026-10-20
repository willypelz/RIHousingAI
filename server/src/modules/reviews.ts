import { Router } from 'express';
import { insert, where, all, getById, updateById, now, today, indexBy, sortBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { getProvider, aiAvailable } from '../ai/provider.js';

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

async function paInProject(paId: string | number, projectId: number) {
  const pa = await getById('project_approvals', paId);
  return pa && pa.project_id === projectId ? pa : null;
}

/** Record agency feedback (comment / RAI). */
reviewsRouter.post('/:projectId/approvals/:paId/comments', requireProjectAccess(), async (req, res) => {
  const { body, comment_type = 'comment', agency_name, stage_id } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Comment body required' });
  const projectId = Number(req.params.projectId);
  const pa = await paInProject(req.params.paId, projectId);
  if (!pa) return res.status(404).json({ error: 'Approval not found' });

  const comment = await insert('review_comments', {
    project_approval_id: pa.id, project_id: projectId, stage_id: stage_id ? Number(stage_id) : null,
    author_user_id: req.user!.id, agency_name: agency_name || null,
    comment_type, body, status: 'open', created_at: now(),
  });

  // RAI creates an applicant task + notifies members
  if (comment_type === 'rai') {
    await insert('tasks', {
      project_id: projectId, project_approval_id: pa.id,
      title: 'Respond to request for additional information',
      description: body.slice(0, 500), waiting_on: 'applicant',
      assignee_user_id: null, verified_due_date: null,
      status: 'open', created_at: now(), completed_at: null,
    });
    const members = await where('project_members', 'project_id', projectId);
    for (const m of members) {
      await insert('notifications', {
        user_id: m.user_id, project_id: projectId,
        message: `New request for additional information recorded: ${body.slice(0, 120)}`,
        read: false, created_at: now(),
      });
    }
  }
  await audit(req.user!.id, 'comment.create', 'review_comment', comment.id, { comment_type });
  res.status(201).json({ comment });
});

reviewsRouter.get('/:projectId/comments', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const comments = sortBy(await where('review_comments', 'project_id', projectId), 'created_at', 'desc');
  const pas = indexBy(await where('project_approvals', 'project_id', projectId));
  const types = indexBy(await all('approval_types'));
  const users = indexBy(await all('users'));
  const responses = await where('comment_responses', 'project_id', projectId);

  res.json({
    comments: comments.map(c => ({
      ...c,
      approval_name: types[pas[c.project_approval_id]?.approval_type_id]?.name ?? null,
      author_name: users[c.author_user_id]?.name ?? null,
      responses: sortBy(responses.filter(r => r.comment_id === c.id), 'created_at')
        .map(r => ({ id: r.id, body: r.body, is_draft: r.is_draft, ai_generated: r.ai_generated, created_at: r.created_at })),
    })),
  });
});

/** Draft a response to a review comment (optionally AI-assisted; always a draft requiring review). */
reviewsRouter.post('/:projectId/comments/:commentId/responses', requireProjectAccess(), async (req, res) => {
  const { body, use_ai } = req.body || {};
  const projectId = Number(req.params.projectId);
  const c = await getById('review_comments', req.params.commentId);
  if (!c || c.project_id !== projectId) return res.status(404).json({ error: 'Comment not found' });

  let text = body;
  let aiGenerated = false;
  if (use_ai && aiAvailable()) {
    const project = await getById('projects', projectId);
    text = await getProvider().complete(
      `You draft professional responses to municipal review comments for housing development applications. Be factual and concise. Never commit to facts you don't have — use [TO CONFIRM] placeholders. This is a DRAFT the applicant must review and approve before submission.`,
      `Project: ${project.name}, ${project.address} (${project.units} units, ${project.dev_type}).\nAgency comment:\n"""${c.body}"""\n\nDraft a response letter body.`);
    aiGenerated = true;
  }
  if (!text) return res.status(400).json({ error: 'Response body required (or set use_ai with an API key configured)' });

  const response = await insert('comment_responses', {
    comment_id: c.id, project_id: projectId, body: text,
    is_draft: true, ai_generated: aiGenerated, created_by: req.user!.id, created_at: now(),
  });
  await updateById('review_comments', c.id, { status: 'responded' });
  await audit(req.user!.id, 'comment.respond', 'review_comment', c.id, { ai_generated: aiGenerated });
  res.status(201).json({ response, notice: 'This is a draft. It must be reviewed and approved by the applicant or an authorized professional before submission.' });
});

reviewsRouter.patch('/:projectId/comments/:commentId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','responded','resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const c = await getById('review_comments', req.params.commentId);
  if (!c || c.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  res.json({ comment: await updateById('review_comments', c.id, { status }) });
});

/** Record an official decision (entered by users; the platform never decides). */
reviewsRouter.post('/:projectId/approvals/:paId/decisions', requireProjectAccess(), async (req, res) => {
  const { decision, decided_on, decided_by, notes, conditions = [] } = req.body || {};
  if (!['approved','approved_with_conditions','denied','continued'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  if (!decided_on || !decided_by) return res.status(400).json({ error: 'decided_on and decided_by are required — record the official decision as issued by the authority' });
  const projectId = Number(req.params.projectId);
  const pa = await paInProject(req.params.paId, projectId);
  if (!pa) return res.status(404).json({ error: 'Approval not found' });

  const dec = await insert('decisions', {
    project_approval_id: pa.id, project_id: projectId,
    decision, decided_on, decided_by, notes: notes || null,
    recorded_by: req.user!.id, created_at: now(),
  });
  for (const cDesc of conditions) {
    await insert('conditions', { decision_id: dec.id, project_id: projectId, description: cDesc, status: 'open', satisfied_at: null });
  }
  await updateById('project_approvals', pa.id, { status: decision });
  await audit(req.user!.id, 'decision.record', 'decision', dec.id, { decision });
  res.status(201).json({ decision: dec });
});

reviewsRouter.get('/:projectId/decisions', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const decisions = sortBy(await where('decisions', 'project_id', projectId), 'decided_on', 'desc');
  const pas = indexBy(await where('project_approvals', 'project_id', projectId));
  const types = indexBy(await all('approval_types'));
  const conditions = await where('conditions', 'project_id', projectId);

  res.json({
    decisions: decisions.map(d => ({
      ...d,
      approval_name: types[pas[d.project_approval_id]?.approval_type_id]?.name ?? null,
      conditions: conditions.filter(c => c.decision_id === d.id)
        .map(c => ({ id: c.id, description: c.description, status: c.status })),
    })),
  });
});

reviewsRouter.patch('/:projectId/conditions/:conditionId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','satisfied','waived'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const c = await getById('conditions', req.params.conditionId);
  if (!c || c.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  res.json({ condition: await updateById('conditions', c.id, { status, satisfied_at: status === 'satisfied' ? today() : null }) });
});

/** Inspections */
reviewsRouter.post('/:projectId/approvals/:paId/inspections', requireProjectAccess(), async (req, res) => {
  const { name, inspector_agency, scheduled_for, result, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Inspection name required' });
  const projectId = Number(req.params.projectId);
  const pa = await paInProject(req.params.paId, projectId);
  if (!pa) return res.status(404).json({ error: 'Approval not found' });
  const inspection = await insert('inspections', {
    project_approval_id: pa.id, project_id: projectId, name,
    inspector_agency: inspector_agency || null, scheduled_for: scheduled_for || null,
    result: result || 'pending', notes: notes || null,
  });
  res.status(201).json({ inspection });
});

reviewsRouter.get('/:projectId/inspections', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const inspections = sortBy(await where('inspections', 'project_id', projectId), 'scheduled_for');
  const pas = indexBy(await where('project_approvals', 'project_id', projectId));
  const types = indexBy(await all('approval_types'));
  res.json({
    inspections: inspections.map(i => ({
      ...i, approval_name: types[pas[i.project_approval_id]?.approval_type_id]?.name ?? null,
    })),
  });
});
