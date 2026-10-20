import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { all, where, deleteWhere, col } from '../src/db/firestore.js';
import { seed } from '../src/db/seed.js';

const app = createApp();
const email = `test-${Date.now()}@example.com`;
let token = '';
let projectId = 0;
let otherUserId = 0;

beforeAll(async () => {
  await seed();
  const reg = await request(app).post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Test User', role: 'developer' });
  expect(reg.status).toBe(201);
  token = reg.body.token;
}, 60_000);

afterAll(async () => {
  if (projectId) {
    for (const c of ['project_approvals','review_stages','checklist_items','documents','document_versions',
      'review_comments','comment_responses','decisions','conditions','inspections','tasks','notifications',
      'completeness_checks','completeness_findings','project_members']) {
      await deleteWhere(c, 'project_id', projectId);
    }
    await col('projects').doc(String(projectId)).delete();
  }
  const users = await where('users', 'email', email);
  for (const u of users) {
    await deleteWhere('notifications', 'user_id', u.id);
    await col('users').doc(String(u.id)).delete();
  }
  if (otherUserId) await col('users').doc(String(otherUserId)).delete();
}, 60_000);

const auth = () => ({ authorization: `Bearer ${token}` });

describe('workflow logic (Cumberland 10-unit project)', () => {
  it('registers a project and generates the pathway', async () => {
    const munis = await all('municipalities');
    const cumberland = munis.find((m: any) => m.name === 'Cumberland');
    const res = await request(app).post('/api/projects').set(auth()).send({
      name: 'Test 10-Unit', address: '1 Test St', municipality_id: cumberland.id,
      dev_type: 'multi_family', units: 10, construction_kind: 'new_construction',
      applicant_name: 'Tester', sewer_service: 'public_sewer', water_service: 'public_water',
    });
    expect(res.status).toBe(201);
    projectId = res.body.project.id;

    const gen = await request(app).post(`/api/projects/${projectId}/pathway/generate`).set(auth());
    expect(gen.status).toBe(201);
  }, 120_000);

  it('OWTS is not applicable for public-sewer projects; stormwater is conditional', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const byCode = Object.fromEntries(res.body.approvals.map((a: any) => [a.code, a]));
    expect(byCode.ridem_owts.applicability).toBe('not_applicable');
    expect(byCode.ridem_stormwater.applicability).toBe('conditional');
    expect(byCode.planning_major_land_dev.applicability).toBe('applicable');
    expect(byCode.fire_plan_review.applicability).toBe('applicable');
  }, 30_000);

  it('generates a source-backed checklist', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/checklist`).set(auth());
    expect(res.body.items.length).toBeGreaterThan(10);
    const withSource = res.body.items.filter((i: any) => i.source_url);
    expect(withSource.length).toBe(res.body.items.length); // every item cites a source
    const fees = res.body.items.filter((i: any) => i.item_type === 'fee');
    expect(fees.every((f: any) => !f.fee_amount)).toBe(true); // no invented fee amounts
  }, 30_000);

  it('blocks completing a stage whose dependencies are unmet', async () => {
    const pw = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const planning = pw.body.approvals.find((a: any) => a.code === 'planning_major_land_dev');
    const stages = pw.body.stages.filter((s: any) => s.project_approval_id === planning.id);
    const decision = stages.find((s: any) => s.code === 'decision');
    const res = await request(app).patch(`/api/projects/${projectId}/stages/${decision.id}`)
      .set(auth()).send({ status: 'complete' });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('depends on incomplete');
  }, 30_000);

  it('auto-activates the next stage when a dependency completes', async () => {
    const pw = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const planning = pw.body.approvals.find((a: any) => a.code === 'planning_major_land_dev');
    const stages = pw.body.stages.filter((s: any) => s.project_approval_id === planning.id);
    const prep = stages.find((s: any) => s.code === 'preparation');
    const ok = await request(app).patch(`/api/projects/${projectId}/stages/${prep.id}`)
      .set(auth()).send({ status: 'complete' });
    expect(ok.status).toBe(200);
    const pw2 = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const submission = pw2.body.stages.find((s: any) => s.project_approval_id === planning.id && s.code === 'submission');
    expect(submission.status).toBe('active');
  }, 30_000);

  it('rejects a verified due date without a source citation', async () => {
    const pw = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const stage = pw.body.stages[0];
    const res = await request(app).patch(`/api/projects/${projectId}/stages/${stage.id}`)
      .set(auth()).send({ verified_due_date: '2030-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('official source');
  }, 30_000);

  it('denies access to non-members', async () => {
    const other = await request(app).post('/api/auth/register')
      .send({ email: `other-${Date.now()}@example.com`, password: 'password123', name: 'Other', role: 'developer' });
    otherUserId = other.body.user.id;
    const res = await request(app).get(`/api/projects/${projectId}`).set({ authorization: `Bearer ${other.body.token}` });
    expect(res.status).toBe(403);
  }, 30_000);

  it('RAI comment creates an applicant task', async () => {
    const pw = await request(app).get(`/api/projects/${projectId}/pathway`).set(auth());
    const planning = pw.body.approvals.find((a: any) => a.code === 'planning_major_land_dev');
    const c = await request(app).post(`/api/projects/${projectId}/approvals/${planning.id}/comments`)
      .set(auth()).send({ body: 'Please provide a revised drainage plan.', comment_type: 'rai' });
    expect(c.status).toBe(201);
    const t = await request(app).get(`/api/projects/${projectId}/tasks`).set(auth());
    expect(t.body.tasks.some((x: any) => x.waiting_on === 'applicant')).toBe(true);
  }, 30_000);

  it('completeness check reports missing documents with evidence', async () => {
    const res = await request(app).post(`/api/projects/${projectId}/completeness-checks`).set(auth());
    expect(res.status).toBe(201);
    expect(res.body.check.disclaimer).toContain('Only the responsible authority');
    const missing = res.body.findings.filter((f: any) => f.finding_type === 'missing_document');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((f: any) => f.evidence)).toBe(true);
  }, 120_000);
});
