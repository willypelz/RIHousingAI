import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/pool.js';
import { requireAuth, requireProjectAccess } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const UPLOAD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf', 'image/png', 'image/jpeg',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

async function extractText(filePath: string, mime: string): Promise<string | null> {
  try {
    if (mime === 'application/pdf') {
      const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js') as any;
      const data = await pdfParse(fs.readFileSync(filePath));
      return (data.text || '').slice(0, 100_000);
    }
    if (mime === 'text/plain') return fs.readFileSync(filePath, 'utf8').slice(0, 100_000);
  } catch { /* extraction is best-effort */ }
  return null;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  application_form: ['application form', 'permit application', 'applicant signature'],
  site_plan: ['site plan', 'existing conditions', 'proposed conditions', 'survey'],
  construction_drawings: ['floor plan', 'elevation', 'construction drawing', 'structural'],
  stormwater: ['stormwater', 'swppp', 'drainage'],
  utility_plan: ['utility plan', 'sewer', 'water main'],
  fire_protection: ['sprinkler', 'fire alarm', 'fire protection'],
  correspondence: ['dear', 'letter', 're:'],
};

function categorize(name: string, text: string | null): string {
  const hay = `${name} ${text ?? ''}`.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(k => hay.includes(k))) return cat;
  }
  return 'uncategorized';
}

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get('/:projectId/documents', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, ci.title AS checklist_item_title,
       (SELECT json_agg(json_build_object('id', v.id, 'version', v.version, 'original_name', v.original_name,
         'uploaded_at', v.uploaded_at, 'size_bytes', v.size_bytes, 'uploaded_by', u.name) ORDER BY v.version DESC)
        FROM document_versions v JOIN users u ON u.id=v.uploaded_by WHERE v.document_id=d.id) AS versions
     FROM documents d LEFT JOIN checklist_items ci ON ci.id=d.checklist_item_id
     WHERE d.project_id=$1 ORDER BY d.created_at DESC`, [req.params.projectId]);
  res.json({ documents: rows });
});

documentsRouter.post('/:projectId/documents', requireProjectAccess(), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required (pdf, docx, png, jpg, txt; max 25MB)' });
  const projectId = Number(req.params.projectId);
  const { document_id, title, checklist_item_id } = req.body || {};

  const sha = crypto.createHash('sha256').update(fs.readFileSync(req.file.path)).digest('hex');
  const text = await extractText(req.file.path, req.file.mimetype);

  let docId = document_id ? Number(document_id) : null;
  let version = 1;
  if (docId) {
    const d = await query(`SELECT id FROM documents WHERE id=$1 AND project_id=$2`, [docId, projectId]);
    if (!d.rows.length) return res.status(404).json({ error: 'Document not found' });
    version = (await query(`SELECT coalesce(max(version),0)+1 AS v FROM document_versions WHERE document_id=$1`, [docId])).rows[0].v;
  } else {
    const category = categorize(req.file.originalname, text);
    const r = await query(
      `INSERT INTO documents (project_id, checklist_item_id, category, title) VALUES ($1,$2,$3,$4) RETURNING id`,
      [projectId, checklist_item_id || null, category, title || req.file.originalname]);
    docId = r.rows[0].id;
  }

  const { rows } = await query(
    `INSERT INTO document_versions (document_id, version, file_path, original_name, mime_type, size_bytes, sha256, extracted_text, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, document_id, version, original_name, uploaded_at`,
    [docId, version, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, sha, text, req.user!.id]);

  await audit(req.user!.id, 'document.upload', 'document', docId, { version, name: req.file.originalname });
  res.status(201).json({ version: rows[0] });
});

documentsRouter.get('/:projectId/documents/versions/:versionId/download', requireProjectAccess(), async (req, res) => {
  const { rows } = await query(
    `SELECT v.file_path, v.original_name, v.mime_type FROM document_versions v
     JOIN documents d ON d.id=v.document_id WHERE v.id=$1 AND d.project_id=$2`,
    [req.params.versionId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(UPLOAD_DIR, path.basename(rows[0].file_path));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from storage' });
  res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${rows[0].original_name.replace(/"/g, '')}"`);
  fs.createReadStream(filePath).pipe(res);
});

documentsRouter.patch('/:projectId/documents/:docId', requireProjectAccess(), async (req, res) => {
  const { category, title, checklist_item_id } = req.body || {};
  const { rows } = await query(
    `UPDATE documents SET category=coalesce($1,category), title=coalesce($2,title), checklist_item_id=coalesce($3,checklist_item_id)
     WHERE id=$4 AND project_id=$5 RETURNING *`,
    [category ?? null, title ?? null, checklist_item_id ?? null, req.params.docId, req.params.projectId]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ document: rows[0] });
});
