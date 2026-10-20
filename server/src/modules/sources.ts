import { Router } from 'express';
import { insert, where, all, getById, updateById, now, indexBy, sortBy } from '../db/firestore.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { ORDINANCE_LINKS, MAP_TOOLS, ZONING_LINKS_CHECKED } from './zoningData.js';

export const sourcesRouter = Router();
sourcesRouter.use(requireAuth);

/** Sources tagged with their municipality (null = statewide) so the client can
 *  filter by location instead of showing one town's sources to everyone. */
sourcesRouter.get('/', async (_req, res) => {
  const sources = sortBy(await all('official_sources'), 'id');
  const agencies = indexBy(await all('agencies'));
  const munis = indexBy(await all('municipalities'));
  const changes = await all('source_changes');
  res.json({
    sources: sources.map(s => {
      const a = agencies[s.agency_id] || {};
      const muniId = a.municipality_id ?? null;
      return {
        ...s,
        agency_name: a.name ?? null, agency_department: a.department ?? null, agency_level: a.level ?? null,
        agency_phone: a.phone ?? null, agency_address: a.address ?? null, agency_website: a.website ?? null,
        municipality_id: muniId, municipality_name: muniId ? munis[muniId]?.name ?? null : null,
        change_history: sortBy(changes.filter(c => c.source_id === s.id), 'changed_at', 'desc')
          .map(c => ({ changed_at: c.changed_at, change_note: c.change_note })),
      };
    }),
  });
});

/** Every town's zoning ordinance location + statewide map tools (TP172, checked date). */
sourcesRouter.get('/town-links', async (_req, res) => {
  res.json({
    links_checked: ZONING_LINKS_CHECKED,
    map_tools: MAP_TOOLS,
    towns: Object.entries(ORDINANCE_LINKS).map(([name, link]) => ({ name, ...link })),
  });
});

sourcesRouter.get('/agencies', async (_req, res) => {
  const agencies = await all('agencies');
  const munis = indexBy(await all('municipalities'));
  res.json({
    agencies: sortBy(sortBy(agencies, 'name'), 'level').map(a => ({
      ...a, municipality_name: a.municipality_id ? munis[a.municipality_id]?.name ?? null : null,
    })),
  });
});

/** Admin/staff: update a source's verification status and log the change. */
sourcesRouter.patch('/:sourceId', requireRole('admin', 'municipal_staff'), async (req, res) => {
  const { last_verified_at, doc_version, fees_note, processing_estimate, content, change_note } = req.body || {};
  if (!change_note) return res.status(400).json({ error: 'change_note is required for source updates (change history)' });
  const s = await getById('official_sources', req.params.sourceId);
  if (!s) return res.status(404).json({ error: 'Source not found' });
  const updated = await updateById('official_sources', s.id, {
    last_verified_at: last_verified_at ?? s.last_verified_at,
    doc_version: doc_version ?? s.doc_version,
    fees_note: fees_note ?? s.fees_note,
    processing_estimate: processing_estimate ?? s.processing_estimate,
    content: content ?? s.content,
  });
  await insert('source_changes', { source_id: s.id, change_note, changed_by: req.user!.id, changed_at: now() });
  await audit(req.user!.id, 'source.update', 'official_source', s.id, { change_note });
  res.json({ source: updated });
});
