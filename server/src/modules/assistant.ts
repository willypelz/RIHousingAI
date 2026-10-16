import { Router } from 'express';
import { query } from '../db/pool.js';
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
  const p = (await query(
    `SELECT p.*, m.name AS municipality_name FROM projects p JOIN municipalities m ON m.id=p.municipality_id WHERE p.id=$1`,
    [projectId])).rows[0];
  if (!p) return '';
  const approvals = (await query(
    `SELECT at.name, pa.applicability, pa.applicability_note, pa.status FROM project_approvals pa
     JOIN approval_types at ON at.id=pa.approval_type_id WHERE pa.project_id=$1`, [projectId])).rows;
  const checklist = (await query(
    `SELECT ci.title, ci.status, at.name AS approval FROM checklist_items ci
     JOIN project_approvals pa ON pa.id=ci.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 AND ci.status NOT IN ('complete','not_applicable') LIMIT 40`, [projectId])).rows;
  const stages = (await query(
    `SELECT rs.name, rs.status, at.name AS approval FROM review_stages rs
     JOIN project_approvals pa ON pa.id=rs.project_approval_id
     JOIN approval_types at ON at.id=pa.approval_type_id
     WHERE pa.project_id=$1 AND rs.status IN ('active','waiting_on_agency','waiting_on_applicant')`, [projectId])).rows;
  const comments = (await query(
    `SELECT rc.comment_type, rc.body, rc.status FROM review_comments rc
     JOIN project_approvals pa ON pa.id=rc.project_approval_id WHERE pa.project_id=$1 AND rc.status != 'resolved' LIMIT 10`, [projectId])).rows;
  return `PROJECT CONTEXT:
${p.name} — ${p.address}, ${p.municipality_name}. ${p.units} units, ${p.dev_type}, ${p.construction_kind}. Status: ${p.status}. Sewer: ${p.sewer_service}, water: ${p.water_service}.
Approval pathway: ${approvals.map(a => `${a.name} [${a.applicability}${a.applicability_note ? ': ' + a.applicability_note : ''}, status: ${a.status}]`).join('; ') || 'not yet generated'}.
Outstanding checklist items: ${checklist.map(c => `${c.title} (${c.approval}, ${c.status})`).join('; ') || 'none recorded'}.
Current stages: ${stages.map(s => `${s.name} (${s.approval}): ${s.status}`).join('; ') || 'none active'}.
Open agency feedback: ${comments.map(c => `[${c.comment_type}] ${c.body.slice(0, 200)}`).join(' | ') || 'none'}.`;
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

  let convId = conversation_id;
  if (!convId) {
    const r = await query(
      `INSERT INTO assistant_conversations (project_id, user_id, title) VALUES ($1,$2,$3) RETURNING id`,
      [project_id || null, req.user!.id, message.slice(0, 80)]);
    convId = r.rows[0].id;
  } else {
    const owns = await query(`SELECT 1 FROM assistant_conversations WHERE id=$1 AND user_id=$2`, [convId, req.user!.id]);
    if (!owns.rows.length) return res.status(403).json({ error: 'Not your conversation' });
  }

  await query(`INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [convId, message]);

  const sources = await retrieveSources(message, 5);
  const projectContext = project_id ? await buildProjectContext(Number(project_id)) : '';

  let answer: string;
  if (aiAvailable()) {
    const history = (await query(
      `SELECT role, content FROM assistant_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 6`, [convId])).rows.reverse();
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

  const saved = (await query(
    `INSERT INTO assistant_messages (conversation_id, role, content, cited_source_ids) VALUES ($1,'assistant',$2,$3) RETURNING *`,
    [convId, answer, sources.map(s => s.id)])).rows[0];

  res.json({
    conversation_id: convId,
    message: saved,
    sources: sources.map(s => ({ id: s.id, title: s.title, url: s.url, authority: s.authority, last_verified_at: s.last_verified_at })),
  });
});

assistantRouter.get('/conversations', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM assistant_conversations WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [req.user!.id]);
  res.json({ conversations: rows });
});

assistantRouter.get('/conversations/:id/messages', async (req, res) => {
  const owns = await query(`SELECT 1 FROM assistant_conversations WHERE id=$1 AND user_id=$2`, [req.params.id, req.user!.id]);
  if (!owns.rows.length) return res.status(403).json({ error: 'Not your conversation' });
  const { rows } = await query(`SELECT * FROM assistant_messages WHERE conversation_id=$1 ORDER BY id`, [req.params.id]);
  res.json({ messages: rows });
});
