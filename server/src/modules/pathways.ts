import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { evaluateApplicability, type ProjectFacts } from './applicability.js';
import { STAGE_TEMPLATES, STAGE_NAMES, CHECKLIST_TEMPLATES } from './pathwayTemplates.js';

export const pathwaysRouter = Router();
pathwaysRouter.use(requireAuth);

/** Generate the approval pathway + checklist for a project from applicability rules. */
pathwaysRouter.post('/:projectId/pathway/generate', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = (await query(`SELECT * FROM projects WHERE id=$1`, [projectId])).rows[0];
  if (!p) return res.status(404).json({ error: 'Project not found' });

  const existing = await query(`SELECT 1 FROM project_approvals WHERE project_id=$1 LIMIT 1`, [projectId]);
  if (existing.rows.length) return res.status(409).json({ error: 'Pathway already generated for this project' });

  const facts: ProjectFacts = {
    units: p.units, construction_kind: p.construction_kind,
    sewer_service: p.sewer_service, water_service: p.water_service,
  };

  const types = (await query(
    `SELECT at.*, a.name AS agency_name, a.department AS agency_department, a.website AS agency_website
     FROM approval_types at LEFT JOIN agencies a ON a.id = at.agency_id`)).rows;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const paIds: Record<string, number> = {};
    const stageIds: Record<string, Record<string, number>> = {};

    for (const t of types) {
      const result = evaluateApplicability(t.applicability_rules, facts);
      const { rows } = await client.query(
        `INSERT INTO project_approvals (project_id, approval_type_id, applicability, applicability_note, status)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [projectId, t.id, result.applicability, result.note,
         result.applicability === 'not_applicable' ? 'not_applicable' : 'not_started']
      );
      const paId = rows[0].id;
      paIds[t.code] = paId;
      if (result.applicability === 'not_applicable') continue;

      // Review stages
      stageIds[t.code] = {};
      const stages = STAGE_TEMPLATES[t.category] || STAGE_TEMPLATES.state;
      const authority = t.agency_department ? `${t.agency_name} — ${t.agency_department}` : t.agency_name;
      let prevStageId: number | null = null;
      for (let i = 0; i < stages.length; i++) {
        const code = stages[i];
        const sr = await client.query(
          `INSERT INTO review_stages (project_approval_id, code, name, responsible_authority, sort_order, status, next_action)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [paId, code, STAGE_NAMES[code], code === 'preparation' || code === 'revisions' ? 'Applicant' : authority, i,
           i === 0 ? 'active' : 'pending',
           i === 0 ? 'Assemble the required application materials from the checklist.' : null]
        );
        stageIds[t.code][code] = sr.rows[0].id;
        if (prevStageId) {
          await client.query(`INSERT INTO stage_dependencies (stage_id, depends_on_stage_id) VALUES ($1,$2)`, [sr.rows[0].id, prevStageId]);
        }
        prevStageId = sr.rows[0].id;
      }

      // Checklist items from template, citing the approval type's official source
      const tpl = CHECKLIST_TEMPLATES[t.code] || [];
      for (let i = 0; i < tpl.length; i++) {
        const item = tpl[i];
        await client.query(
          `INSERT INTO checklist_items (project_approval_id, title, item_type, description, responsible_authority,
             submission_link, source_id, fee_source_id, fee_verified_date, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [paId, item.title, item.item_type, item.description, authority,
           t.agency_website, t.source_id,
           item.item_type === 'fee' ? t.source_id : null,
           item.item_type === 'fee' ? new Date() : null, i]
        );
      }
    }

    // Cross-approval dependencies (official sequencing):
    // building submission waits for planning decision; inspections wait for building decision.
    const dep = async (fromCode: string, fromStage: string, toCode: string, toStage: string) => {
      const from = stageIds[fromCode]?.[fromStage];
      const to = stageIds[toCode]?.[toStage];
      if (from && to) await client.query(
        `INSERT INTO stage_dependencies (stage_id, depends_on_stage_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [from, to]);
    };
    await dep('building_permit', 'submission', 'planning_major_land_dev', 'decision');
    await dep('inspections_co', 'inspections', 'building_permit', 'decision');
    await dep('fire_plan_review', 'decision', 'building_permit', 'technical_review');

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await audit(req.user!.id, 'pathway.generate', 'project', projectId);
  res.status(201).json({ ok: true });
});

/** Full pathway view: approvals + stages + dependencies. */
pathwaysRouter.get('/:projectId/pathway', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const approvals = (await query(
    `SELECT pa.*, at.code, at.name, at.category, at.description,
            a.name AS agency_name, a.department AS agency_department, a.phone AS agency_phone,
            a.website AS agency_website, a.address AS agency_address,
            s.title AS source_title, s.url AS source_url, s.last_verified_at AS source_verified,
            s.processing_estimate
     FROM project_approvals pa
     JOIN approval_types at ON at.id = pa.approval_type_id
     LEFT JOIN agencies a ON a.id = at.agency_id
     LEFT JOIN official_sources s ON s.id = at.source_id
     WHERE pa.project_id=$1 ORDER BY at.id`, [projectId])).rows;

  const stages = (await query(
    `SELECT rs.* FROM review_stages rs
     JOIN project_approvals pa ON pa.id = rs.project_approval_id
     WHERE pa.project_id=$1 ORDER BY rs.project_approval_id, rs.sort_order`, [projectId])).rows;

  const deps = (await query(
    `SELECT sd.* FROM stage_dependencies sd
     JOIN review_stages rs ON rs.id = sd.stage_id
     JOIN project_approvals pa ON pa.id = rs.project_approval_id
     WHERE pa.project_id=$1`, [projectId])).rows;

  res.json({ approvals, stages, dependencies: deps });
});

/** Checklist for a project (grouped by approval). */
pathwaysRouter.get('/:projectId/checklist', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT ci.*, at.code AS approval_code, at.name AS approval_name, pa.applicability,
            s.title AS source_title, s.url AS source_url, s.last_verified_at AS source_verified,
            fs.fees_note AS fee_note, fs.url AS fee_source_url
     FROM checklist_items ci
     JOIN project_approvals pa ON pa.id = ci.project_approval_id
     JOIN approval_types at ON at.id = pa.approval_type_id
     LEFT JOIN official_sources s ON s.id = ci.source_id
     LEFT JOIN official_sources fs ON fs.id = ci.fee_source_id
     WHERE pa.project_id=$1 ORDER BY at.id, ci.sort_order`, [req.params.projectId]);
  res.json({ items: rows });
});

/** Update a checklist item's status. */
pathwaysRouter.patch('/:projectId/checklist/:itemId', requireProjectAccess(), async (req, res) => {
  const { status } = req.body || {};
  if (!['pending','in_progress','complete','not_applicable'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { rows } = await query(
    `UPDATE checklist_items ci SET status=$1,
       completed_at = CASE WHEN $1='complete' THEN now() ELSE NULL END,
       completed_by = CASE WHEN $1='complete' THEN $2 ELSE NULL END
     FROM project_approvals pa
     WHERE ci.id=$3 AND pa.id=ci.project_approval_id AND pa.project_id=$4
     RETURNING ci.*`,
    [status, req.user!.id, req.params.itemId, req.params.projectId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Checklist item not found' });
  await audit(req.user!.id, 'checklist.update', 'checklist_item', req.params.itemId, { status });
  res.json({ item: rows[0] });
});
