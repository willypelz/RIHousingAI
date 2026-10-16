import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

sourcesRouter.get('/', async (_req, res) => {
  const { rows } = await query(
    `SELECT s.*, a.name AS agency_name, a.department AS agency_department, a.level AS agency_level,
            a.phone AS agency_phone, a.address AS agency_address, a.website AS agency_website,
            (SELECT json_agg(json_build_object('changed_at', sc.changed_at, 'change_note', sc.change_note) ORDER BY sc.changed_at DESC)
             FROM source_changes sc WHERE sc.source_id=s.id) AS change_history
     FROM official_sources s LEFT JOIN agencies a ON a.id=s.agency_id ORDER BY s.id`);
  res.json({ sources: rows });
});

sourcesRouter.get('/agencies', async (_req, res) => {
  const { rows } = await query(
    `SELECT a.*, m.name AS municipality_name FROM agencies a LEFT JOIN municipalities m ON m.id=a.municipality_id ORDER BY a.level, a.name`);
  res.json({ agencies: rows });
});

/** Admin/staff: update a source's verification status and log the change. */
sourcesRouter.patch('/:sourceId', requireRole('admin', 'municipal_staff'), async (req, res) => {
  const { last_verified_at, doc_version, fees_note, processing_estimate, content, change_note } = req.body || {};
  if (!change_note) return res.status(400).json({ error: 'change_note is required for source updates (change history)' });
  const { rows } = await query(
    `UPDATE official_sources SET
       last_verified_at = coalesce($1, last_verified_at),
       doc_version = coalesce($2, doc_version),
       fees_note = coalesce($3, fees_note),
       processing_estimate = coalesce($4, processing_estimate),
       content = coalesce($5, content)
     WHERE id=$6 RETURNING *`,
    [last_verified_at ?? null, doc_version ?? null, fees_note ?? null, processing_estimate ?? null, content ?? null, req.params.sourceId]);
  if (!rows.length) return res.status(404).json({ error: 'Source not found' });
  await query(`INSERT INTO source_changes (source_id, change_note, changed_by) VALUES ($1,$2,$3)`,
    [req.params.sourceId, change_note, req.user!.id]);
  await audit(req.user!.id, 'source.update', 'official_source', req.params.sourceId, { change_note });
  res.json({ source: rows[0] });
});
