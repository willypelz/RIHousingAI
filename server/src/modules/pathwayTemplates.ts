/** Stage and checklist templates per approval category/code. Checklist items always
 *  cite the approval type's official source; fees are never invented. */

export const STAGE_NAMES: Record<string, string> = {
  preparation: 'Application Preparation',
  submission: 'Submission',
  completeness_review: 'Administrative Completeness Review',
  technical_review: 'Technical & Departmental Review',
  rai: 'Requests for Additional Information',
  revisions: 'Applicant Revisions',
  hearing: 'Public Hearing / Board Review',
  decision: 'Decision',
  conditions: 'Conditions of Approval',
  inspections: 'Inspections',
  final_signoff: 'Final Sign-offs / Certificate of Occupancy',
};

export const STAGE_TEMPLATES: Record<string, string[]> = {
  planning: ['preparation','submission','completeness_review','technical_review','rai','revisions','hearing','decision','conditions'],
  building: ['preparation','submission','completeness_review','technical_review','revisions','decision'],
  fire: ['preparation','submission','technical_review','revisions','decision'],
  utility: ['preparation','submission','technical_review','decision'],
  environmental: ['preparation','submission','technical_review','decision'],
  state: ['preparation','submission','decision'],
  inspection: ['inspections','final_signoff'],
};

export interface ChecklistTemplateItem {
  title: string;
  item_type: 'form'|'document'|'plan'|'certification'|'fee'|'instruction'|'prerequisite'|'referral'|'hearing';
  description: string;
}

export const CHECKLIST_TEMPLATES: Record<string, ChecklistTemplateItem[]> = {
  planning_major_land_dev: [
    { title: 'Pre-application concept meeting with Planning Department', item_type: 'instruction', description: 'Recommended first step: schedule a pre-application meeting with the Planning Department to confirm the review track and submission requirements for your project.' },
    { title: 'Master Plan application form', item_type: 'form', description: 'Completed major land development Master Plan application form, signed by the applicant and property owner.' },
    { title: 'Site plans by registered professional', item_type: 'plan', description: 'Existing and proposed conditions site plans prepared and stamped by a RI-registered professional engineer or land surveyor.' },
    { title: 'Utility plan', item_type: 'plan', description: 'Proposed water, sewer and drainage utility layout.' },
    { title: 'Stormwater management plan', item_type: 'plan', description: 'Stormwater management plan consistent with RI stormwater design standards.' },
    { title: 'Landscaping plan', item_type: 'plan', description: 'Proposed landscaping and buffering plan, if required by the regulations for the review stage.' },
    { title: 'Application fee (per Town fee schedule)', item_type: 'fee', description: 'Fee amount is set by the Town fee schedule. Confirm the current amount with the Planning Department before submitting — fee amounts are not predicted by this platform.' },
    { title: 'Radius map and abutter notification list', item_type: 'document', description: 'List of abutting property owners for public notice, as required for public hearing stages.' },
    { title: 'Public hearing (master plan stage, major projects)', item_type: 'hearing', description: 'Major land development master plan review includes a public hearing with notice per RIGL 45-23. The Planning Department schedules the hearing after the application is certified complete.' },
  ],
  building_permit: [
    { title: 'Planning approval (prerequisite)', item_type: 'prerequisite', description: 'Final plan approval from the Planning Board is generally required before a building permit can be issued for a land development project.' },
    { title: 'Building permit application form', item_type: 'form', description: 'Completed building permit application signed by the owner or authorized agent.' },
    { title: 'Stamped construction drawings', item_type: 'plan', description: 'Construction plans stamped by a RI-registered architect or professional engineer (required for multi-unit buildings).' },
    { title: 'Contractor registration information', item_type: 'certification', description: 'RI contractor registration number for the general contractor.' },
    { title: 'Permit fee (based on construction value)', item_type: 'fee', description: 'Calculated per the Town fee schedule based on construction value. Confirm with the Building & Zoning Office.' },
    { title: 'Trade permits (electrical, mechanical, plumbing)', item_type: 'referral', description: 'Separate permits pulled by licensed trades-persons.' },
  ],
  fire_plan_review: [
    { title: 'Fire plan review application', item_type: 'form', description: 'Plan review application to the fire marshal having jurisdiction.' },
    { title: 'Fire protection system plans', item_type: 'plan', description: 'Sprinkler and fire alarm plans prepared by qualified designers, where systems are required for the building type.' },
    { title: 'Confirm reviewing authority', item_type: 'instruction', description: 'Confirm with the Cumberland Fire District whether local or State Fire Marshal review applies to this building type.' },
  ],
  sewer_connection: [
    { title: 'Confirm public sewer availability for the parcel', item_type: 'instruction', description: 'Contact Cumberland DPW to confirm the parcel is served by public sewer and whether capacity review is needed for a multi-unit project.' },
    { title: 'Sewer connection permit application', item_type: 'form', description: 'Sewer connection application to the Department of Public Works.' },
    { title: 'Sewer connection/assessment fee', item_type: 'fee', description: 'Per the Town fee schedule; confirm with DPW.' },
  ],
  ridem_owts: [
    { title: 'OWTS application by licensed designer', item_type: 'form', description: 'OWTS permit application prepared by a RI-licensed OWTS designer; required only if the project is not served by public sewer.' },
    { title: 'Site suitability determination / soil evaluation', item_type: 'document', description: 'Soil evaluation and site suitability documentation per RIDEM OWTS rules.' },
    { title: 'RIDEM application fee', item_type: 'fee', description: 'Published by RIDEM; confirm the current amount on the RIDEM website.' },
  ],
  water_connection: [
    { title: 'Water availability confirmation', item_type: 'instruction', description: 'Request confirmation of water service availability and any capacity/fire-flow requirements from the Cumberland Water Department.' },
    { title: 'Water connection application', item_type: 'form', description: 'New service connection application for each unit or master meter configuration.' },
    { title: 'Connection fee', item_type: 'fee', description: 'Per the Water Department fee schedule; confirm before design.' },
  ],
  ridem_stormwater: [
    { title: 'Confirm land disturbance area', item_type: 'instruction', description: 'This permit applies only if construction disturbs one acre or more (or is part of a larger common plan). Confirm the disturbed area with your engineer.' },
    { title: 'Notice of Intent (RIPDES CGP)', item_type: 'form', description: 'Notice of Intent for coverage under the RIPDES Construction General Permit, if applicable.' },
    { title: 'Stormwater Pollution Prevention Plan (SWPPP)', item_type: 'plan', description: 'SWPPP prepared per RIDEM requirements, if the permit applies.' },
  ],
  e911_addressing: [
    { title: 'Address assignment request', item_type: 'form', description: 'Request official address assignments for all new units through the Town addressing authority.' },
  ],
  inspections_co: [
    { title: 'Building permit issued (prerequisite)', item_type: 'prerequisite', description: 'Inspections begin after the building permit is issued.' },
    { title: 'Milestone inspections', item_type: 'instruction', description: 'Schedule required inspections (footing/foundation, framing, electrical, mechanical, plumbing, insulation, fire) with the Building Official at prescribed milestones.' },
    { title: 'Final inspections and Certificate of Occupancy', item_type: 'certification', description: 'Final inspections by building and fire officials, then Certificate of Occupancy from the Building Official before occupancy.' },
  ],
};
