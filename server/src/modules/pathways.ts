import { Router } from 'express';
import { insert, where, all, getById, updateById, deleteWhere, now, today, indexBy, sortBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { evaluateApplicability, type ProjectFacts } from './applicability.js';
import { STAGE_TEMPLATES, STAGE_NAMES, CHECKLIST_TEMPLATES } from './pathwayTemplates.js';

export const pathwaysRouter = Router();
pathwaysRouter.use(requireAuth);

/** Build (or rebuild) the approval pathway + checklist for a project from applicability rules. */
export async function buildPathway(p: any): Promise<void> {
  const projectId = p.id;
  const facts: ProjectFacts = {
    units: p.units, construction_kind: p.construction_kind,
    sewer_service: p.sewer_service, water_service: p.water_service,
  };

  // Select approval types dynamically for the project's municipality:
  // - types bound to this municipality (verified local data)
  // - statewide types (municipality_id null) whose functional slot is not
  //   already covered by a local type; generic fallbacks are flagged unverified.
  const municipality = await getById('municipalities', p.municipality_id);
  const allTypes = sortBy(await all('approval_types'), 'id');
  const localTypes = allTypes.filter(t => t.municipality_id === p.municipality_id);
  const coveredSlots = new Set(localTypes.map(t => t.slot).filter(Boolean));
  const types = [
    ...localTypes,
    ...allTypes.filter(t => t.municipality_id == null && (!t.slot || !coveredSlots.has(t.slot))),
  ].sort((a, b) => a.id - b.id);

  const agencies = indexBy(await all('agencies'));
  const unverifiedNote = `Local procedures for ${municipality?.name ?? 'this municipality'} are not yet verified on this platform — confirm requirements, forms, and fees directly with the municipal offices.`;

  const stageIds: Record<string, Record<string, number>> = {};

  for (const t of types) {
    const result = evaluateApplicability(t.applicability_rules, facts);
    if (t.is_generic && result.applicability !== 'not_applicable') {
      result.note = result.note ? `${unverifiedNote} ${result.note}` : unverifiedNote;
      if (result.applicability === 'applicable') result.applicability = 'conditional';
    }
    const pa = await insert('project_approvals', {
      project_id: projectId, approval_type_id: t.id,
      applicability: result.applicability, applicability_note: result.note,
      status: result.applicability === 'not_applicable' ? 'not_applicable' : 'not_started',
      submitted_at: null, verified_due_date: null, due_date_source_id: null,
    });
    if (result.applicability === 'not_applicable') continue;

    const agency = (t.agency_id && agencies[t.agency_id]) || {};
    const authority = agency.name
      ? (agency.department ? `${agency.name} — ${agency.department}` : agency.name)
      : `${municipality?.name ?? 'Municipal'} ${t.category === 'planning' ? 'Planning Department' : t.category === 'utility' ? 'utility authority' : 'authorities'} (confirm locally)`;

    // Review stages (sequential dependency chain within the approval)
    stageIds[t.code] = {};
    const stages = STAGE_TEMPLATES[t.category] || STAGE_TEMPLATES.state;
    let prevStageId: number | null = null;
    for (let i = 0; i < stages.length; i++) {
      const code = stages[i];
      const stage = await insert('review_stages', {
        project_approval_id: pa.id, project_id: projectId, code, name: STAGE_NAMES[code],
        responsible_authority: code === 'preparation' || code === 'revisions' ? 'Applicant' : authority,
        sort_order: i,
        status: i === 0 ? 'active' : 'pending',
        next_action: i === 0 ? 'Assemble the required application materials from the checklist.' : null,
        submitted_at: null, verified_due_date: null, due_date_source_id: null,
        depends_on: prevStageId ? [prevStageId] : [],
      });
      stageIds[t.code][code] = stage.id;
      prevStageId = stage.id;
    }

    // Checklist items from template, citing the approval type's official source
    const tpl = CHECKLIST_TEMPLATES[t.code] || [];
    for (let i = 0; i < tpl.length; i++) {
      const item = tpl[i];
      await insert('checklist_items', {
        project_approval_id: pa.id, project_id: projectId,
        title: item.title, item_type: item.item_type, description: item.description,
        responsible_authority: authority, submission_link: agency.website ?? null,
        source_id: t.source_id,
        fee_amount: null,
        fee_source_id: item.item_type === 'fee' ? t.source_id : null,
        fee_verified_date: item.item_type === 'fee' ? today() : null,
        status: 'pending', completed_at: null, completed_by: null,
        ai_generated: false, sort_order: i,
      });
    }
  }

  // Cross-approval dependencies (official sequencing). Codes resolve to either the
  // municipality-specific type or its generic statewide fallback.
  const resolve = (codes: string[], stage: string) => {
    for (const c of codes) if (stageIds[c]?.[stage]) return stageIds[c][stage];
    return undefined;
  };
  const addDep = async (from?: number, to?: number) => {
    if (from && to) {
      const stage = await getById('review_stages', from);
      await updateById('review_stages', from, { depends_on: [...new Set([...(stage?.depends_on || []), to])] });
    }
  };
  const PLANNING = ['planning_major_land_dev', 'planning_generic'];
  const BUILDING = ['building_permit', 'building_permit_generic'];
  const FIRE = ['fire_plan_review', 'fire_generic'];
  const INSPECTIONS = ['inspections_co', 'inspections_generic'];
  await addDep(resolve(BUILDING, 'submission'), resolve(PLANNING, 'decision'));
  await addDep(resolve(INSPECTIONS, 'inspections'), resolve(BUILDING, 'decision'));
  await addDep(resolve(FIRE, 'decision'), resolve(BUILDING, 'technical_review'));
}

pathwaysRouter.post('/:projectId/pathway/generate', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = await getById('projects', projectId);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const existing = await where('project_approvals', 'project_id', projectId);
  if (existing.length) return res.status(409).json({ error: 'Pathway already generated for this project' });
  await buildPathway(p);
  await audit(req.user!.id, 'pathway.generate', 'project', projectId);
  res.status(201).json({ ok: true });
});

/** Regenerate the pathway after zoning analysis / utility confirmation updates the project
 *  facts. Rebuilds approvals, stages, and checklist from the current applicability rules.
 *  Manual progress on the old pathway is replaced — intended for the pre-application phase. */
pathwaysRouter.post('/:projectId/pathway/regenerate', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const p = await getById('projects', projectId);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  for (const c of ['project_approvals', 'review_stages', 'checklist_items']) {
    await deleteWhere(c, 'project_id', projectId);
  }
  await buildPathway(p);
  await audit(req.user!.id, 'pathway.regenerate', 'project', projectId);
  res.status(201).json({ ok: true });
});

/** Full pathway view: approvals + stages + dependencies. */
pathwaysRouter.get('/:projectId/pathway', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const pas = await where('project_approvals', 'project_id', projectId);
  const types = indexBy(await all('approval_types'));
  const agencies = indexBy(await all('agencies'));
  const sources = indexBy(await all('official_sources'));

  const approvals = sortBy(pas.map(pa => {
    const t = types[pa.approval_type_id] || {};
    const a = agencies[t.agency_id] || {};
    const s = sources[t.source_id] || {};
    return {
      ...pa, code: t.code, name: t.name, category: t.category, description: t.description,
      agency_name: a.name ?? null, agency_department: a.department ?? null, agency_phone: a.phone ?? null,
      agency_website: a.website ?? null, agency_address: a.address ?? null,
      source_title: s.title ?? null, source_url: s.url ?? null, source_verified: s.last_verified_at ?? null,
      processing_estimate: s.processing_estimate ?? null,
    };
  }), 'approval_type_id');

  const stages = sortBy(await where('review_stages', 'project_id', projectId), 'sort_order')
    .sort((a, b) => a.project_approval_id - b.project_approval_id || a.sort_order - b.sort_order);

  const dependencies = stages.flatMap((s: any) =>
    (s.depends_on || []).map((dep: number) => ({ stage_id: s.id, depends_on_stage_id: dep })));

  res.json({ approvals, stages, dependencies });
});

/** Checklist for a project (grouped by approval). */
pathwaysRouter.get('/:projectId/checklist', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const items = await where('checklist_items', 'project_id', projectId);
  const pas = indexBy(await where('project_approvals', 'project_id', projectId));
  const types = indexBy(await all('approval_types'));
  const sources = indexBy(await all('official_sources'));

  const rows = items.map(ci => {
    const pa = pas[ci.project_approval_id] || {};
    const t = types[pa.approval_type_id] || {};
    const s = sources[ci.source_id] || {};
    const fs = sources[ci.fee_source_id] || {};
    return {
      ...ci, approval_code: t.code, approval_name: t.name, applicability: pa.applicability,
      source_title: s.title ?? null, source_url: s.url ?? null, source_verified: s.last_verified_at ?? null,
      fee_note: fs.fees_note ?? null, fee_source_url: fs.url ?? null,
      _type_order: pa.approval_type_id ?? 0,
    };
  }).sort((a, b) => a._type_order - b._type_order || a.sort_order - b.sort_order);

  res.json({ items: rows });
});

/** Update a checklist item's status and/or the applicant's own planning target date.
 *  target_date is the user's plan — never an official deadline. */
pathwaysRouter.patch('/:projectId/checklist/:itemId', requireProjectAccess(), async (req, res) => {
  const { status, target_date } = req.body || {};
  if (status !== undefined && !['pending','in_progress','complete','not_applicable'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (target_date !== undefined && target_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(target_date))) {
    return res.status(400).json({ error: 'target_date must be YYYY-MM-DD or null' });
  }
  const item = await getById('checklist_items', req.params.itemId);
  if (!item || item.project_id !== Number(req.params.projectId)) {
    return res.status(404).json({ error: 'Checklist item not found' });
  }
  const updates: Record<string, any> = {};
  if (status !== undefined) {
    updates.status = status;
    updates.completed_at = status === 'complete' ? now() : null;
    updates.completed_by = status === 'complete' ? req.user!.id : null;
  }
  if (target_date !== undefined) updates.target_date = target_date;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No fields to update' });
  const updated = await updateById('checklist_items', item.id, updates);
  await audit(req.user!.id, 'checklist.update', 'checklist_item', item.id, { status, target_date });
  res.json({ item: updated });
});
