/** Pure applicability engine: evaluates approval-type rules against project details.
 *  Never assumes an approval applies — rules must establish it, otherwise the
 *  result is 'conditional' with a note to confirm with the authority. */

export interface ProjectFacts {
  units: number;
  construction_kind: string;
  sewer_service: 'public_sewer' | 'septic' | 'unknown';
  water_service: 'public_water' | 'well' | 'unknown';
}

export interface ApplicabilityRules {
  min_units?: number;
  construction_kinds?: string[];
  requires?: Record<string, string>;
  conditional?: boolean;
  conditional_on_unknown?: string;
  condition_note?: string;
}

export interface ApplicabilityResult {
  applicability: 'applicable' | 'conditional' | 'not_applicable';
  note: string | null;
}

export function evaluateApplicability(rules: ApplicabilityRules, project: ProjectFacts): ApplicabilityResult {
  if (rules.min_units != null && project.units < rules.min_units) {
    return { applicability: 'not_applicable', note: `Applies to projects with ${rules.min_units}+ units.` };
  }
  if (rules.construction_kinds && !rules.construction_kinds.includes(project.construction_kind)) {
    return { applicability: 'not_applicable', note: `Applies to: ${rules.construction_kinds.join(', ')}.` };
  }
  if (rules.requires) {
    for (const [field, value] of Object.entries(rules.requires)) {
      const actual = (project as any)[field];
      if (actual === 'unknown' && rules.conditional_on_unknown === field) {
        return { applicability: 'conditional', note: rules.condition_note || `Depends on ${field}; confirm with the responsible authority.` };
      }
      if (actual !== value) {
        return { applicability: 'not_applicable', note: rules.condition_note || `Requires ${field} = ${value}.` };
      }
    }
  }
  if (rules.conditional) {
    return { applicability: 'conditional', note: rules.condition_note || 'Applicability depends on project specifics; confirm with the responsible authority.' };
  }
  return { applicability: 'applicable', note: rules.condition_note ?? null };
}
