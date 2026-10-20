import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { insert, where, getById, updateById, now, indexBy, sortBy } from '../db/firestore.js';
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
  const projectId = Number(req.params.projectId);
  const docs = sortBy(await where('documents', 'project_id', projectId), 'created_at', 'desc');
  const versions = await where('document_versions', 'project_id', projectId);
  const items = indexBy(await where('checklist_items', 'project_id', projectId));
  const usersById = indexBy(await (await import('../db/firestore.js')).all('users'));

  res.json({
    documents: docs.map(d => ({
      ...d,
      checklist_item_title: d.checklist_item_id ? items[d.checklist_item_id]?.title ?? null : null,
      versions: sortBy(versions.filter(v => v.document_id === d.id), 'version', 'desc')
        .map(v => ({
          id: v.id, version: v.version, original_name: v.original_name,
          uploaded_at: v.uploaded_at, size_bytes: v.size_bytes,
          uploaded_by: usersById[v.uploaded_by]?.name ?? String(v.uploaded_by),
        })),
    })),
  });
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
    const d = await getById('documents', docId);
    if (!d || d.project_id !== projectId) return res.status(404).json({ error: 'Document not found' });
    const existing = await where('document_versions', 'document_id', docId);
    version = Math.max(0, ...existing.map(v => v.version)) + 1;
  } else {
    const category = categorize(req.file.originalname, text);
    const doc = await insert('documents', {
      project_id: projectId, checklist_item_id: checklist_item_id ? Number(checklist_item_id) : null,
      category, title: title || req.file.originalname, created_at: now(),
    });
    docId = doc.id;
  }

  const v = await insert('document_versions', {
    document_id: docId, project_id: projectId, version,
    file_path: req.file.filename, original_name: req.file.originalname,
    mime_type: req.file.mimetype, size_bytes: req.file.size, sha256: sha,
    extracted_text: text, uploaded_by: req.user!.id, uploaded_at: now(),
  });

  await audit(req.user!.id, 'document.upload', 'document', docId, { version, name: req.file.originalname });
  res.status(201).json({ version: { id: v.id, document_id: docId, version, original_name: v.original_name, uploaded_at: v.uploaded_at } });
});

documentsRouter.get('/:projectId/documents/versions/:versionId/download', requireProjectAccess(), async (req, res) => {
  const v = await getById('document_versions', req.params.versionId);
  if (!v || v.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(UPLOAD_DIR, path.basename(v.file_path));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from storage' });
  res.setHeader('Content-Type', v.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${v.original_name.replace(/"/g, '')}"`);
  fs.createReadStream(filePath).pipe(res);
});

documentsRouter.patch('/:projectId/documents/:docId', requireProjectAccess(), async (req, res) => {
  const { category, title, checklist_item_id } = req.body || {};
  const d = await getById('documents', req.params.docId);
  if (!d || d.project_id !== Number(req.params.projectId)) return res.status(404).json({ error: 'Not found' });
  const updated = await updateById('documents', d.id, {
    category: category ?? d.category,
    title: title ?? d.title,
    checklist_item_id: checklist_item_id ?? d.checklist_item_id,
  });
  res.json({ document: updated });
});
