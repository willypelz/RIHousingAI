import { Router } from 'express';
import { getById, updateById, now } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { FUNDING_PROGRAMS, FUNDING_DISCLAIMER, FUNDING_LINKS_CHECKED } from './fundingData.js';

export const fundingRouter = Router();
fundingRouter.use(requireAuth);

/** Funding programs + the project's saved stack (total cost and selected sources). */
fundingRouter.get('/:projectId/funding', requireProjectAccess(), async (req, res) => {
  const project = await getById('projects', Number(req.params.projectId));
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({
    disclaimer: FUNDING_DISCLAIMER,
    links_checked: FUNDING_LINKS_CHECKED,
    programs: FUNDING_PROGRAMS,
    stack: project.funding ?? { total_cost: null, sources: [] },
  });
});

/** Save the user's funding stack: total cost + selected sources with user-entered amounts.
 *  Amounts are the applicant's own planning figures — never program estimates. */
fundingRouter.patch('/:projectId/funding', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { total_cost, sources } = req.body || {};
  const validCodes = new Set(FUNDING_PROGRAMS.map(p => p.code));
  const cleanSources = Array.isArray(sources)
    ? sources
        .filter((s: any) => s && (validCodes.has(s.code) || s.code === 'other'))
        .slice(0, 20)
        .map((s: any) => ({
          code: String(s.code),
          label: s.code === 'other' ? String(s.label || 'Other source').slice(0, 120) : null,
          amount: Number.isFinite(Number(s.amount)) && Number(s.amount) >= 0 ? Number(s.amount) : 0,
        }))
    : [];
  const funding = {
    total_cost: Number.isFinite(Number(total_cost)) && Number(total_cost) >= 0 ? Number(total_cost) : null,
    sources: cleanSources,
    updated_at: now(),
  };
  await updateById('projects', projectId, { funding });
  await audit(req.user!.id, 'funding.update', 'project', projectId, { sources: cleanSources.length });
  res.json({ stack: funding });
});
