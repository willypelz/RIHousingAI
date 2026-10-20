import { Router } from 'express';
import { insert, where, all, getById, updateById, now, indexBy, sortBy } from '../db/firestore.js';
import { requireAuth, canAccessProject } from '../middleware/auth.js';
import { getProvider, aiAvailable } from '../ai/provider.js';
import { retrieveSources, formatSourcesForPrompt } from '../ai/retrieval.js';

export const assistantRouter = Router();
assistantRouter.use(requireAuth);

const SYSTEM = `You are RIHousingAI's approval assistant. You help applicants navigate the ADMINISTRATIVE approval process for residential development in Rhode Island (currently focused on Cumberland).

Strict rules:
- Ground every answer ONLY in the provided [SOURCE n] excerpts and project context.
- Cite sources inline as clean markdown links using a short readable name, e.g. [Cumberland Planning Dept](https://...). NEVER use "[SOURCE n]" notation in your reply — always convert citations to named markdown links.
- Never invent fees, deadlines, required approvals, or agency decisions. If a source gives a published processing estimate, present it as a published estimate, not a prediction.
- If the sources do not establish an answer, say so explicitly and recommend contacting the responsible authority (include its contact details if provided).
- You do NOT perform zoning analysis or predict approval outcomes.

Style:
- Be concise and direct. Answer the question first; skip introductions about who you are or how you work unless asked.
- Use short paragraphs and markdown bullet lists. Use **bold** sparingly for key terms.
- End with one brief line noting sources were last verified on their stated date and should be re-confirmed with the authority — do not repeat this mid-answer.`;

async function buildProjectContext(projectId: number): Promise<string> {
  const p = await getById('projects', projectId);
  if (!p) return '';
  const munis = indexBy(await all('municipalities'));
  const types = indexBy(await all('approval_types'));
  const pas = await where('project_approvals', 'project_id', projectId);
  const pasById = indexBy(pas);
  const approvalName = (paId: number) => types[pasById[paId]?.approval_type_id]?.name ?? '';

  const approvals = pas.map(a => `${types[a.approval_type_id]?.name} [${a.applicability}${a.applicability_note ? ': ' + a.applicability_note : ''}, status: ${a.status}]`);
  const checklist = (await where('checklist_items', 'project_id', projectId))
    .filter(c => !['complete', 'not_applicable'].includes(c.status)).slice(0, 40)
    .map(c => `${c.title} (${approvalName(c.project_approval_id)}, ${c.status})`);
  const stages = (await where('review_stages', 'project_id', projectId))
    .filter(s => ['active', 'waiting_on_agency', 'waiting_on_applicant'].includes(s.status))
    .map(s => `${s.name} (${approvalName(s.project_approval_id)}): ${s.status}`);
  const comments = (await where('review_comments', 'project_id', projectId))
    .filter(c => c.status !== 'resolved').slice(0, 10)
    .map(c => `[${c.comment_type}] ${c.body.slice(0, 200)}`);

  return `PROJECT CONTEXT:
${p.name} — ${p.address}, ${munis[p.municipality_id]?.name}. ${p.units} units, ${p.dev_type}, ${p.construction_kind}. Status: ${p.status}. Sewer: ${p.sewer_service}, water: ${p.water_service}.
Approval pathway: ${approvals.join('; ') || 'not yet generated'}.
Outstanding checklist items: ${checklist.join('; ') || 'none recorded'}.
Current stages: ${stages.join('; ') || 'none active'}.
Open agency feedback: ${comments.join(' | ') || 'none'}.`;
}

function fallbackAnswer(sources: Awaited<ReturnType<typeof retrieveSources>>): string {
  const lines = sources.map(s =>
    `- ${s.title} (${s.authority}) — ${s.summary ?? ''} See: ${s.url} (last verified ${s.last_verified_at ?? 'unknown'})`);
  return `AI answering is not configured (no API key), so here are the most relevant official sources for your question:\n\n${lines.join('\n')}\n\nFor a definitive answer, contact the responsible authority listed with each source.`;
}

assistantRouter.post('/chat', async (req, res) => {
  const { project_id, conversation_id, message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (project_id && !(await canAccessProject(req.user!, Number(project_id)))) {
    return res.status(403).json({ error: 'You do not have access to this project' });
  }

  let convId = conversation_id ? Number(conversation_id) : null;
  if (!convId) {
    const conv = await insert('assistant_conversations', {
      project_id: project_id ? Number(project_id) : null, user_id: req.user!.id,
      title: message.slice(0, 80), created_at: now(),
    });
    convId = conv.id;
  } else {
    const conv = await getById('assistant_conversations', convId);
    if (!conv || conv.user_id !== req.user!.id) return res.status(403).json({ error: 'Not your conversation' });
  }

  await insert('assistant_messages', { conversation_id: convId, role: 'user', content: message, cited_source_ids: [], created_at: now() });

  const sources = await retrieveSources(message, 5);
  const projectContext = project_id ? await buildProjectContext(Number(project_id)) : '';

  let answer: string;
  if (aiAvailable()) {
    const history = sortBy(await where('assistant_messages', 'conversation_id', convId), 'id').slice(-6);
    const historyText = history.slice(0, -1).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    try {
      answer = await getProvider().complete(SYSTEM,
        `${projectContext}\n\nOFFICIAL SOURCES:\n${formatSourcesForPrompt(sources)}\n\n${historyText ? 'CONVERSATION SO FAR:\n' + historyText + '\n\n' : ''}USER QUESTION: ${message}`,
        2000);
    } catch (e) {
      console.error('Assistant AI call failed:', (e as Error).message);
      answer = fallbackAnswer(sources);
    }
  } else {
    answer = fallbackAnswer(sources);
  }

  const saved = await insert('assistant_messages', {
    conversation_id: convId, role: 'assistant', content: answer,
    cited_source_ids: sources.map(s => s.id), created_at: now(),
  });

  res.json({
    conversation_id: convId,
    message: saved,
    sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url, authority: s.authority, last_verified_at: s.last_verified_at })),
  });
});

assistantRouter.get('/conversations', async (req, res) => {
  const rows = sortBy(await where('assistant_conversations', 'user_id', req.user!.id), 'created_at', 'desc').slice(0, 20);
  res.json({ conversations: rows });
});

assistantRouter.get('/conversations/:id/messages', async (req, res) => {
  const conv = await getById('assistant_conversations', req.params.id);
  if (!conv || conv.user_id !== req.user!.id) return res.status(403).json({ error: 'Not your conversation' });
  res.json({ messages: sortBy(await where('assistant_messages', 'conversation_id', conv.id), 'id') });
});
