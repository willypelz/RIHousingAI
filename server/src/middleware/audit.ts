import { query } from '../db/pool.js';

export async function audit(actorUserId: number | null, action: string, entityType: string, entityId: string | number | null, detail?: object) {
  await query(
    `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, detail) VALUES ($1,$2,$3,$4,$5)`,
    [actorUserId, action, entityType, entityId == null ? null : String(entityId), detail ? JSON.stringify(detail) : null]
  );
}
