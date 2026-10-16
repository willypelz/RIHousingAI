import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  municipality_id: z.number().int(),
  dev_type: z.string().min(1),
  units: z.number().int().positive(),
  construction_kind: z.enum(['new_construction','conversion','addition']),
  description: z.string().optional().nullable(),
  applicant_name: z.string().min(1),
  applicant_email: z.string().email().optional().nullable(),
  applicant_phone: z.string().optional().nullable(),
  representative_name: z.string().optional().nullable(),
  representative_email: z.string().email().optional().nullable(),
  existing_application_numbers: z.string().optional().nullable(),
  sewer_service: z.enum(['public_sewer','septic','unknown']).default('unknown'),
  water_service: z.enum(['public_water','well','unknown']).default('unknown'),
  status: z.string().default('pre_application'),
});

projectsRouter.get('/', async (req, res) => {
  const u = req.user!;
  const isStaff = u.role === 'admin' || u.role === 'municipal_staff';
  const { rows } = await query(
    `SELECT p.*, m.name AS municipality_name
     FROM projects p JOIN municipalities m ON m.id = p.municipality_id
     ${isStaff ? '' : 'JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1'}
     ORDER BY p.created_at DESC`,
    isStaff ? [] : [u.id]
  );
  res.json({ projects: rows });
});

projectsRouter.post('/', async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const d = parsed.data;
  const { rows } = await query(
    `INSERT INTO projects (name, address, municipality_id, dev_type, units, construction_kind, description, status,
      applicant_name, applicant_email, applicant_phone, representative_name, representative_email,
      existing_application_numbers, sewer_service, water_service, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [d.name, d.address, d.municipality_id, d.dev_type, d.units, d.construction_kind, d.description ?? null, d.status,
     d.applicant_name, d.applicant_email ?? null, d.applicant_phone ?? null, d.representative_name ?? null,
     d.representative_email ?? null, d.existing_application_numbers ?? null, d.sewer_service, d.water_service, req.user!.id]
  );
  const project = rows[0];
  await query(`INSERT INTO project_members (project_id, user_id, member_role) VALUES ($1,$2,'owner')`, [project.id, req.user!.id]);
  await audit(req.user!.id, 'project.create', 'project', project.id, { name: project.name });
  res.status(201).json({ project });
});

projectsRouter.get('/:projectId', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, m.name AS municipality_name, m.coverage_status
     FROM projects p JOIN municipalities m ON m.id=p.municipality_id WHERE p.id=$1`,
    [req.params.projectId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Project not found' });
  res.json({ project: rows[0] });
});

projectsRouter.patch('/:projectId', requireProjectAccess(), async (req, res) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  const entries = Object.entries(parsed.data);
  if (!entries.length) return res.status(400).json({ error: 'No fields to update' });
  const sets = entries.map(([k], i) => `${k}=$${i + 1}`).join(', ');
  const { rows } = await query(
    `UPDATE projects SET ${sets} WHERE id=$${entries.length + 1} RETURNING *`,
    [...entries.map(([, v]) => v), req.params.projectId]
  );
  await audit(req.user!.id, 'project.update', 'project', req.params.projectId, parsed.data);
  res.json({ project: rows[0] });
});

projectsRouter.post('/:projectId/members', requireProjectAccess(), async (req, res) => {
  const { email, member_role = 'member' } = req.body || {};
  const u = await query(`SELECT id FROM users WHERE email=$1`, [email]);
  if (!u.rows.length) return res.status(404).json({ error: 'No user with that email' });
  await query(
    `INSERT INTO project_members (project_id, user_id, member_role) VALUES ($1,$2,$3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET member_role=$3`,
    [req.params.projectId, u.rows[0].id, member_role]
  );
  await audit(req.user!.id, 'project.member_add', 'project', req.params.projectId, { email, member_role });
  res.status(201).json({ ok: true });
});

projectsRouter.get('/:projectId/members', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, pm.member_role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1`,
    [req.params.projectId]
  );
  res.json({ members: rows });
});

export const municipalitiesRouter = Router();
municipalitiesRouter.get('/', async (_req, res) => {
  const { rows } = await query(`SELECT * FROM municipalities ORDER BY name`);
  res.json({ municipalities: rows });
});
