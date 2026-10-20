import { all } from '../db/firestore.js';

export interface SourceDoc {
  id: number; authority: string; title: string; url: string; summary: string | null;
  content: string | null; fees_note: string | null; processing_estimate: string | null;
  last_verified_at: string | null;
}

/** Simple keyword retrieval over official_sources (sufficient for the curated corpus).
 *  When municipalityId is given, another municipality's local sources are excluded so a
 *  Warwick project never gets grounded in Cumberland-specific procedures. */
export async function retrieveSources(queryText: string, limit = 5, municipalityId?: number | null): Promise<SourceDoc[]> {
  const terms = queryText.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  let rows = await all<SourceDoc & { agency_id?: number | null }>('official_sources');
  if (municipalityId != null) {
    const agencies = await all<{ id: number; municipality_id: number | null }>('agencies');
    const agencyMuni = new Map(agencies.map(a => [a.id, a.municipality_id]));
    rows = rows.filter(s => {
      const muni = s.agency_id ? agencyMuni.get(s.agency_id) ?? null : null;
      return muni == null || muni === municipalityId; // statewide or this municipality
    });
  }
  const scored = rows.map(s => {
    const hay = `${s.title} ${s.summary ?? ''} ${s.content ?? ''}`.toLowerCase();
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
    return { s, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map(x => x.s);
  return top.length ? top : rows.slice(0, limit);
}

export function formatSourcesForPrompt(sources: SourceDoc[]): string {
  return sources.map(s =>
    `[SOURCE ${s.id}] ${s.authority} — "${s.title}"\nURL: ${s.url}\nLast verified: ${s.last_verified_at ?? 'unknown'}\n${s.content ?? s.summary ?? ''}${s.fees_note ? `\nFees: ${s.fees_note}` : ''}${s.processing_estimate ? `\nPublished processing estimate: ${s.processing_estimate}` : ''}`
  ).join('\n\n---\n\n');
}
