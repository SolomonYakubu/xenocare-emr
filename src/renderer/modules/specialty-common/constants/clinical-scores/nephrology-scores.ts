/**
 * =============================================================================
 * NEPHROLOGY CLINICAL SCORES
 * =============================================================================
 * Validated renal scoring instruments:
 * - CKD Stage : GFR-based CKD staging (G1–G5)
 * =============================================================================
 */

import type { ClinicalScoreDefinition } from '../../dtos/specialty-clinic.dto';

// -----------------------------------------------------------------------------
// CKD Stage — eGFR-based KDIGO Staging
// -----------------------------------------------------------------------------
export const CKD_STAGE_SCORE: ClinicalScoreDefinition = {
  id: 'ckd-stage',
  name: 'CKD Stage',
  full_name: 'CKD Stage (KDIGO 2024 eGFR Classification)',
  specialty_codes: ['NEPHROLOGY'],
  description:
    'Classifies chronic kidney disease by estimated GFR (eGFR, mL/min/1.73 m²). Combined with albuminuria category for full risk staging.',
  items: [
    {
      id: 'ckd_egfr_stage',
      question: 'Select the eGFR stage based on current laboratory result:',
      options: [
        { value: 1, label: 'G1 — Normal or high (eGFR ≥ 90 mL/min/1.73 m²)' },
        { value: 2, label: 'G2 — Mildly decreased (eGFR 60–89)' },
        {
          value: 3,
          label: 'G3a — Mildly to moderately decreased (eGFR 45–59)',
        },
        {
          value: 4,
          label: 'G3b — Moderately to severely decreased (eGFR 30–44)',
        },
        { value: 5, label: 'G4 — Severely decreased (eGFR 15–29)' },
        { value: 6, label: 'G5 — Kidney failure (eGFR < 15 or dialysis)' },
      ],
    },
    {
      id: 'ckd_albuminuria',
      question: 'Albuminuria category (urine ACR):',
      options: [
        {
          value: 0,
          label:
            'A1 — Normal to mildly increased (ACR < 3 mg/mmol or < 30 mg/g)',
        },
        {
          value: 1,
          label: 'A2 — Moderately increased (ACR 3–30 mg/mmol / 30–300 mg/g)',
        },
        {
          value: 2,
          label: 'A3 — Severely increased (ACR > 30 mg/mmol / > 300 mg/g)',
        },
      ],
    },
  ],
  max_score: 8,
  severity_ranges: [
    {
      min: 1,
      max: 2,
      label: 'G1–G2: Normal to Mild decrease',
      color: '#22c55e',
      clinical_action:
        'Identify and treat underlying cause. Manage CV risk factors. Annual eGFR + ACR monitoring.',
    },
    {
      min: 3,
      max: 4,
      label: 'G3a–G3b: Moderate decrease',
      color: '#eab308',
      clinical_action:
        'Nephrology review. RAAS blockade (ACEi/ARB) if proteinuric. Dietary advice. Avoid nephrotoxins. Bone mineral density check.',
    },
    {
      min: 5,
      max: 5,
      label: 'G4: Severe decrease',
      color: '#E9783F',
      clinical_action:
        'Nephrology follow-up (3–6 monthly). Prepare for renal replacement therapy (RRT). Dialysis or transplant planning.',
    },
    {
      min: 6,
      max: 8,
      label: 'G5: Kidney failure',
      color: '#ef4444',
      clinical_action:
        'Urgent nephrology review. Initiate RRT (haemodialysis / peritoneal dialysis / transplant). Anaemia and mineral bone disease management.',
    },
  ],
  interpretation_notes:
    'G1 and G2 only count as CKD if markers of kidney damage are present (proteinuria, haematuria, structural or genetic abnormality). Always combine eGFR with albuminuria for full KDIGO risk colour classification.',
};

export const NEPHROLOGY_SCORES: ClinicalScoreDefinition[] = [CKD_STAGE_SCORE];
