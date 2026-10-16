import { describe, it, expect } from 'vitest';
import { evaluateApplicability, type ProjectFacts } from '../src/modules/applicability.js';

const base: ProjectFacts = { units: 10, construction_kind: 'new_construction', sewer_service: 'public_sewer', water_service: 'public_water' };

describe('applicability engine', () => {
  it('applies min_units threshold', () => {
    expect(evaluateApplicability({ min_units: 2 }, base).applicability).toBe('applicable');
    expect(evaluateApplicability({ min_units: 2 }, { ...base, units: 1 }).applicability).toBe('not_applicable');
  });

  it('filters by construction kind', () => {
    expect(evaluateApplicability({ construction_kinds: ['new_construction'] }, base).applicability).toBe('applicable');
    expect(evaluateApplicability({ construction_kinds: ['conversion'] }, base).applicability).toBe('not_applicable');
  });

  it('OWTS not applicable when on public sewer', () => {
    const rules = { requires: { sewer_service: 'septic' }, conditional_on_unknown: 'sewer_service' };
    expect(evaluateApplicability(rules, base).applicability).toBe('not_applicable');
  });

  it('OWTS applicable when on septic', () => {
    const rules = { requires: { sewer_service: 'septic' }, conditional_on_unknown: 'sewer_service' };
    expect(evaluateApplicability(rules, { ...base, sewer_service: 'septic' }).applicability).toBe('applicable');
  });

  it('marks conditional (never assumes) when service is unknown', () => {
    const rules = { requires: { sewer_service: 'public_sewer' }, conditional_on_unknown: 'sewer_service', condition_note: 'Confirm with DPW.' };
    const r = evaluateApplicability(rules, { ...base, sewer_service: 'unknown' });
    expect(r.applicability).toBe('conditional');
    expect(r.note).toContain('Confirm');
  });

  it('explicitly-conditional rules stay conditional, with note', () => {
    const r = evaluateApplicability({ conditional: true }, base);
    expect(r.applicability).toBe('conditional');
    expect(r.note).toBeTruthy();
  });

  it('fire review threshold: 3+ units', () => {
    expect(evaluateApplicability({ min_units: 3 }, { ...base, units: 10 }).applicability).toBe('applicable');
    expect(evaluateApplicability({ min_units: 3 }, { ...base, units: 2 }).applicability).toBe('not_applicable');
  });
});
