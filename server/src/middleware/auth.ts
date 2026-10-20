import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { where } from '../db/firestore.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthUser { id: number; email: string; role: string; name: string; }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: AuthUser } }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

/** Allow access if the user is a project member, municipal_staff, or admin. */
export async function canAccessProject(user: AuthUser, projectId: number): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'municipal_staff') return true;
  const members = await where('project_members', 'project_id', projectId);
  return members.some(m => m.user_id === user.id);
}

export function requireProjectAccess(paramName = 'projectId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number(req.params[paramName]);
    if (!Number.isInteger(projectId)) return res.status(400).json({ error: 'Invalid project id' });
    if (!req.user || !(await canAccessProject(req.user, projectId))) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }
    next();
  };
}
