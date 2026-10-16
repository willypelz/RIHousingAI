import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

export const authRouter = Router();

const ROLES = ['developer','architect_engineer','contractor','consultant','municipal_staff','admin'] as const;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(ROLES).default('developer'),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password, name } = parsed.data;
  let role = parsed.data.role;
  // municipal_staff and admin accounts must be provisioned by an admin
  if (role === 'municipal_staff' || role === 'admin') role = 'developer';
  const existing = await query(`SELECT 1 FROM users WHERE email=$1`, [email]);
  if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role`,
    [email, hash, name, role]
  );
  const user = rows[0];
  await audit(user.id, 'user.register', 'user', user.id);
  res.status(201).json({ token: signToken(user), user });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { rows } = await query(`SELECT id, email, name, role, password_hash FROM users WHERE email=$1`, [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password_hash, ...user } = rows[0];
  await audit(user.id, 'user.login', 'user', user.id);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
