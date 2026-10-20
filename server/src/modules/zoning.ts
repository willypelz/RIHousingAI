import { Router } from 'express';
import { getById, updateById, insert, where, now, sortBy } from '../db/firestore.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { getProvider, aiAvailable } from '../ai/provider.js';
import {
  ORDINANCE_LINKS, MAP_TOOLS, DIMENSIONAL_CHECKS, STATE_REFORMS, REFORMS_SOURCE,
  SUPPORTED_LANGUAGES, ZONING_LINKS_CHECKED,
} from './zoningData.js';

export const zoningRouter = Router();
zoningRouter.use(requireAuth);

const DISCLAIMER = 'This panel helps you find and record zoning information from official sources. It is not a zoning determination — the legal answer for a parcel comes from the town\u2019s official zoning map and ordinance, or a zoning certificate from the town (issued within 20 days of a written request under RIGL 45-24-54).';

/** Zoning panel: ordinance link for the project's town, map tools to find the district,
 *  dimensional blanks the user fills from the ordinance, and relevant state reforms. */
zoningRouter.get('/:projectId/zoning', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const municipality = await getById('municipalities', project.municipality_id);
  const ordinance = ORDINANCE_LINKS[municipality?.name] ?? null;

  const saved = project.zoning || {};
  const reforms = STATE_REFORMS.map(r => ({
    code: r.code, name: r.name, statute: r.statute, bill: r.bill, effective: r.effective,
    summary: r.summary,
    relevance: r.relevance({ units: project.units, construction_kind: project.construction_kind }),
  }));

  res.json({
    disclaimer: DISCLAIMER,
    links_checked: ZONING_LINKS_CHECKED,
    municipality: municipality?.name ?? null,
    ordinance: ordinance ? {
      ...ordinance,
      note: `The zoning ordinance for ${municipality.name} is on ${ordinance.platform}${ordinance.where ? ` (${ordinance.where})` : ''}. Open the use table and dimensional table for your district.`,
    } : null,
    map_tools: MAP_TOOLS,
    district: saved.district ?? null,
    district_confirmed_from: saved.district_confirmed_from ?? null,
    checks: DIMENSIONAL_CHECKS.map(c => ({
      ...c,
      value: saved.checks?.[c.key] ?? null,
      lookup_url: ordinance?.url ?? null,
    })),
    reforms: { items: reforms, source: REFORMS_SOURCE, note: 'Rhode Island\u2019s 2024\u20132026 housing reforms may allow more than the local ordinance text shows, because hosted codes can lag state law. Confirm the current statute before relying on any entry.' },
    languages: SUPPORTED_LANGUAGES,
  });
});

/** Save user-confirmed district and dimensional values (recorded, never computed). */
zoningRouter.patch('/:projectId/zoning', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { district, district_confirmed_from, checks } = req.body || {};
  const zoning = { ...(project.zoning || {}) };
  if (district !== undefined) zoning.district = district || null;
  if (district_confirmed_from !== undefined) zoning.district_confirmed_from = district_confirmed_from || null;
  if (checks && typeof checks === 'object') {
    zoning.checks = { ...(zoning.checks || {}) };
    for (const c of DIMENSIONAL_CHECKS) {
      if (checks[c.key] !== undefined) zoning.checks[c.key] = checks[c.key] || null;
    }
  }
  zoning.updated_at = now();
  await updateById('projects', projectId, { zoning });
  await audit(req.user!.id, 'zoning.update', 'project', projectId, { district: zoning.district });
  res.json({ zoning });
});

function languageName(code: string): string | null {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.name ?? null;
}

/** Translate provided UI texts. Street names, place names, proper nouns, and URLs stay as-is. */
zoningRouter.post('/:projectId/zoning/translate', requireProjectAccess(), async (req, res) => {
  const { language, texts } = req.body || {};
  const lang = languageName(language);
  if (!lang) return res.status(400).json({ error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.map(l => l.code).join(', ')}` });
  if (!Array.isArray(texts) || !texts.length || texts.length > 80) return res.status(400).json({ error: 'texts must be a non-empty array (max 80)' });
  if (language === 'en') return res.json({ translations: texts });
  if (!aiAvailable()) return res.status(503).json({ error: 'Translation requires the AI service, which is not configured.' });

  const raw = await getProvider().complete(
    `You are a professional translator. Translate each numbered item into ${lang}.
Rules: keep street names, place names, agency proper names, statute citations (e.g. "RIGL 45-24-73"), bill numbers, and URLs EXACTLY as-is, untranslated. Keep numbers and dates as-is. Plain, accessible wording.
Respond ONLY with a JSON array of the translated strings, same length and order as the input.`,
    JSON.stringify(texts), 4000);
  const start = raw.indexOf('['); const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return res.status(502).json({ error: 'Translation failed — try again.' });
  const translations = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    return res.status(502).json({ error: 'Translation returned an unexpected shape — try again.' });
  }
  res.json({ translations });
});

/** Plain-language project summary for neighbors and the public hearing, in the chosen language. */
zoningRouter.post('/:projectId/public-summary', requireProjectAccess(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { language = 'en' } = req.body || {};
  const lang = languageName(language);
  if (!lang) return res.status(400).json({ error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.map(l => l.code).join(', ')}` });
  if (!aiAvailable()) return res.status(503).json({ error: 'Summaries require the AI service, which is not configured.' });

  const project = await getById('projects', projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const municipality = await getById('municipalities', project.municipality_id);
  const pas = await where('project_approvals', 'project_id', projectId);
  const stages = await where('review_stages', 'project_id', projectId);
  const active = stages.filter(s => ['active', 'waiting_on_agency', 'waiting_on_applicant'].includes(s.status)).map(s => s.name);

  const summary = await getProvider().complete(
    `You write plain-language summaries of proposed housing projects for neighbors and public hearings. Audience: non-experts. Short sentences, everyday words, no jargon or acronyms (spell out what things mean). Neutral and factual — do not advocate for or against the project. Do not invent details not provided. Keep street names, place names, and proper names exactly as-is. Write in ${lang}. Structure: what is proposed, where, what approvals it needs, where the process stands now, and how the public hearing works (people can attend and speak). End with: details and dates should be confirmed with the town.`,
    `Project: ${project.name} at ${project.address}, ${municipality?.name}, Rhode Island.
${project.units} homes (${project.dev_type.replace(/_/g, ' ')}), ${project.construction_kind.replace(/_/g, ' ')}.
Description: ${project.description || 'not provided'}.
Zoning district (as recorded by applicant): ${project.zoning?.district || 'not yet confirmed'}.
Approvals in the pathway: ${pas.length ? pas.map(a => a.status).length + ' approvals tracked' : 'not yet generated'}.
Current process steps: ${active.join('; ') || 'application preparation'}.`,
    1500);

  const saved = await insert('public_summaries', {
    project_id: projectId, language, language_name: lang, content: summary,
    created_by: req.user!.id, created_at: now(),
    notice: 'AI-generated summary — review for accuracy before sharing publicly.',
  });
  await audit(req.user!.id, 'public_summary.generate', 'project', projectId, { language });
  res.status(201).json({ summary: saved });
});

zoningRouter.get('/:projectId/public-summaries', requireProjectAccess(), async (req, res) => {
  const rows = sortBy(await where('public_summaries', 'project_id', Number(req.params.projectId)), 'created_at', 'desc').slice(0, 10);
  res.json({ summaries: rows });
});
