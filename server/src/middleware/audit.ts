import { insert, now } from '../db/firestore.js';

export async function audit(actorUserId: number | null, action: string, entityType: string, entityId: string | number | null, detail?: object) {
  await insert('audit_events', {
    actor_user_id: actorUserId, action, entity_type: entityType,
    entity_id: entityId == null ? null : String(entityId),
    detail: detail ?? null, created_at: now(),
  });
}
