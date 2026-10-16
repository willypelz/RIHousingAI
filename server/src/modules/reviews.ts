import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { getProvider, aiAvailable } from '../ai/provider.js';

export const reviewsRouter = Router();
reviewsRouter.use(requireAuth);

/** Record agency feedback (comment / RAI). */
reviewsRouter.post('/:projectId/approvals/:paId/comments', requireProjectAccess(), async (req, res) => {
  const { body, comment_type = 'comment', agency_name, stage_id } = req.body || {};
  if (!body) return res.status(400).json({ error: 'Comment body required' });
  const pa = await query(`SELECT id FROM project_approvals WHERE id=$1 AND project_id=$2`, [req.params.paId, req.params.projectId]);
  if (!pa.rows.length) return res.status(404).json({ error: 'Approval not found' });
  const { rows } = await query(
    `INSERT INTO review_comments (project_approval_id, stage_id, author_user_id, agency_name, comment_type, body)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.paId, stage_id || null, req.user!.id, agency_name || null, comment_type, body]);

  // RAI creates an applicant task + notifies members
  if (comment_type === 'rai') {
    await query(
      `INSERT INTO tasks (project_id, project_approval_id, title, description, waiting_on)
       VALUES ($1,$2,$3,$4,'applicant')`,
      [req.params.projectId, req.params.paId, 'Respond to request for additional information', body.slice(0, 500)]);
    const members = await query(`SELECT user_id FROM project_members WHERE project_id=$1`, [req.params.projectId]);
    for (const m of members.rows) {
      await query(`INSERT INTO notifications (user_id, project_id, message) VALUES ($1,$2,$3)`,
        [m.user_id, req.params.projectId, `New request for additional information recorded: ${body.slice(0, 120)}`]);
    }
  }
  await audit(req.user!.id, 'comment.create', 'review_comment', rows[0].id, { comment_type });
  res.status(201).json({ comment: rows[0] });
});

reviewsRouter.get('/:projectId/comments', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT rc.*, at.name AS approval_name, u.name AS author_name,
       (SELECT json_agg(json_build_object('id', cr.id, 'body', cr.body, 'is_draft', cr.is_draft,
          'ai_generated', cr.ai_generated, 'created_at', cr.created_at) ORDER BY cr.created_at)
        FROM comment_responses cr WHERE cr.comment_id=rc.id) AS responses
     FROM review_comments rc
     JOIN project_approvals pa ON pa.id=rc.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     LEFT JOIN users u ON u.id=rc.author_user_id
     WHERE pa.project_id=$1 ORDER BY rc.created_at DESC`, [req.params.projectId]);
  res.json({ comments: rows });
});

/** Draft a response to a review comment (optionally AI-assisted; always a draft requiring review). */
reviewsRouter.post('/:projectId/comments/:commentId/responses', requireProjectAccess(), async (req, res) => {
  const { body, use_ai } = req.body || {};
  const c = (await query(
    `SELECT rc.* FROM review_comments rc JOIN project_approvals pa ON pa.id=rc.project_approval_id
     WHERE rc.id=$1 AND pa.project_id=$2`, [req.params.commentId, req.params.projectId])).rows[0];
  if (!c) return res.status(404).json({ error: 'Comment not found' });

  let text = body;
  let aiGenerated = false;
  if (use_ai && aiAvailable()) {
    const project = (await query(`SELECT name, address, units, dev_type FROM projects WHERE id=$1`, [req.params.projectId])).rows[0];
    text = await getProvider().complete(
      `You draft professional responses to municipal review comments for housing development applications. Be factual and concise. Never commit to facts you don't have — use [TO CONFIRM] placeholders. This is a DRAFT the applicant must review and approve before submission.`,
      `Project: ${project.name}, ${project.address} (${project.units} units, ${project.dev_type}).\nAgency comment:\n"""${c.body}"""\n\nDraft a response letter body.`);
    aiGenerated = true;
  }
  if (!text) return res.status(400).json({ error: 'Response body required (or set use_ai with an API key configured)' });

  const { rows } = await query(
    `INSERT INTO comment_responses (comment_id, body, is_draft, ai_generated, created_by)
     VALUES ($1,$2,true,$3,$4) RETURNING *`, [req.params.commentId, text, aiGenerated, req.user!.id]);
  await query(`UPDATE review_comments SET status='responded' WHERE id=$1`, [req.params.commentId]);
  await audit(req.user!.id, 'comment.respond', 'review_comment', req.params.commentId, { ai_generated: aiGenerated });
  res.status(201).json({ response: rows[0], notice: 'This is a draft. It must be reviewed and approved by the applicant or an authorized professional before submission.' });
});

reviewsRouter.patch('/:projectId/comments/:commentId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','responded','resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query(
    `UPDATE review_comments rc SET status=$1 FROM project_approvals pa
     WHERE rc.id=$2 AND pa.id=rc.project_approval_id AND pa.project_id=$3 RETURNING rc.*`,
    [status, req.params.commentId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ comment: rows[0] });
});

/** Record an official decision (entered by users; the platform never decides). */
reviewsRouter.post('/:projectId/approvals/:paId/decisions', requireProjectAccess(), async (req, res) => {
  const { decision, decided_on, decided_by, notes, conditions = [] } = req.body || {};
  if (!['approved','approved_with_conditions','denied','continued'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  if (!decided_on || !decided_by) return res.status(400).json({ error: 'decided_on and decided_by are required — record the official decision as issued by the authority' });
  const pa = await query(`SELECT id FROM project_approvals WHERE id=$1 AND project_id=$2`, [req.params.paId, req.params.projectId]);
  if (!pa.rows.length) return res.status(404).json({ error: 'Approval not found' });

  const { rows } = await query(
    `INSERT INTO decisions (project_approval_id, decision, decided_on, decided_by, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.paId, decision, decided_on, decided_by, notes || null, req.user!.id]);
  for (const cDesc of conditions) {
    await query(`INSERT INTO conditions (decision_id, description) VALUES ($1,$2)`, [rows[0].id, cDesc]);
  }
  await query(`UPDATE project_approvals SET status=$1 WHERE id=$2`, [decision, req.params.paId]);
  await audit(req.user!.id, 'decision.record', 'decision', rows[0].id, { decision });
  res.status(201).json({ decision: rows[0] });
});

reviewsRouter.get('/:projectId/decisions', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, at.name AS approval_name,
       (SELECT json_agg(json_build_object('id', c.id, 'description', c.description, 'status', c.status)) FROM conditions c WHERE c.decision_id=d.id) AS conditions
     FROM decisions d
     JOIN project_approvals pa ON pa.id=d.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 ORDER BY d.decided_on DESC`, [req.params.projectId]);
  res.json({ decisions: rows });
});

reviewsRouter.patch('/:projectId/conditions/:conditionId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['open','satisfied','waived'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await query(
    `UPDATE conditions c SET status=$1, satisfied_at = CASE WHEN $1='satisfied' THEN CURRENT_DATE ELSE NULL END
     FROM decisions d, project_approvals pa
     WHERE c.id=$2 AND d.id=c.decision_id AND pa.id=d.project_approval_id AND pa.project_id=$3 RETURNING c.*`,
    [status, req.params.conditionId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ condition: rows[0] });
});

/** Inspections */
reviewsRouter.post('/:projectId/approvals/:paId/inspections', requireProjectAccess(), async (req, res) => {
  const { name, inspector_agency, scheduled_for, result, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Inspection name required' });
  const { rows } = await query(
    `INSERT INTO inspections (project_approval_id, name, inspector_agency, scheduled_for, result, notes)
     SELECT pa.id, $1,$2,$3,$4,$5 FROM project_approvals pa WHERE pa.id=$6 AND pa.project_id=$7 RETURNING *`,
    [name, inspector_agency || null, scheduled_for || null, result || 'pending', notes || null, req.params.paId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Approval not found' });
  res.status(201).json({ inspection: rows[0] });
});

reviewsRouter.get('/:projectId/inspections', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, at.name AS approval_name FROM inspections i
     JOIN project_approvals pa ON pa.id=i.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 ORDER BY i.scheduled_for NULLS LAST`, [req.params.projectId]);
  res.json({ inspections: rows });
});
