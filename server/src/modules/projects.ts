import { Router } from 'express';
import { z } from 'zod';
import { insert, where, all, getById, updateById, now, indexBy, sortBy, col } from '../db/firestore.js';
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

async function withMunicipality(projects: any[]) {
  const munis = indexBy(await all('municipalities'));
  return projects.map(p => ({
    ...p,
    municipality_name: munis[p.municipality_id]?.name ?? null,
    coverage_status: munis[p.municipality_id]?.coverage_status ?? null,
  }));
}

projectsRouter.get('/', async (req, res) => {
  const u = req.user!;
  const isStaff = u.role === 'admin' || u.role === 'municipal_staff';
  let projects = await all('projects');
  if (!isStaff) {
    const memberships = await where('project_members', 'user_id', u.id);
    const ids = new Set(memberships.map(m => m.project_id));
    projects = projects.filter(p => ids.has(p.id));
  }
  res.json({ projects: await withMunicipality(sortBy(projects, 'created_at', 'desc')) });
});

projectsRouter.post('/', async (req, res) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  const d = parsed.data;
  const project = await insert('projects', {
    ...d,
    description: d.description ?? null,
    applicant_email: d.applicant_email ?? null,
    applicant_phone: d.applicant_phone ?? null,
    representative_name: d.representative_name ?? null,
    representative_email: d.representative_email ?? null,
    existing_application_numbers: d.existing_application_numbers ?? null,
    created_by: req.user!.id,
    created_at: now(),
  });
  await col('project_members').doc(`${project.id}_${req.user!.id}`).set({
    project_id: project.id, user_id: req.user!.id, member_role: 'owner',
  });
  await audit(req.user!.id, 'project.create', 'project', project.id, { name: project.name });
  res.status(201).json({ project });
});

projectsRouter.get('/:projectId', requireProjectAccess(), async (req, res) => {
  const project = await getById('projects', req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({ project: (await withMunicipality([project]))[0] });
});

projectsRouter.patch('/:projectId', requireProjectAccess(), async (req, res) => {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  if (!Object.keys(parsed.data).length) return res.status(400).json({ error: 'No fields to update' });
  const project = await updateById('projects', req.params.projectId, parsed.data);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  await audit(req.user!.id, 'project.update', 'project', req.params.projectId, parsed.data);
  res.json({ project });
});

projectsRouter.post('/:projectId/members', requireProjectAccess(), async (req, res) => {
  const { email, member_role = 'member' } = req.body || {};
  const users = await where('users', 'email', email);
  if (!users.length) return res.status(404).json({ error: 'No user with that email' });
  const projectId = Number(req.params.projectId);
  await col('project_members').doc(`${projectId}_${users[0].id}`).set({
    project_id: projectId, user_id: users[0].id, member_role,
  });
  await audit(req.user!.id, 'project.member_add', 'project', projectId, { email, member_role });
  res.status(201).json({ ok: true });
});

projectsRouter.get('/:projectId/members', requireProjectAccess(), async (req, res) => {
  const members = await where('project_members', 'project_id', Number(req.params.projectId));
  const users = indexBy(await all('users'));
  res.json({
    members: members.map(m => {
      const u = users[m.user_id] || {};
      return { id: m.user_id, name: u.name, email: u.email, role: u.role, member_role: m.member_role };
    }),
  });
});

export const municipalitiesRouter = Router();
municipalitiesRouter.get('/', async (_req, res) => {
  res.json({ municipalities: sortBy(await all('municipalities'), 'name') });
});
