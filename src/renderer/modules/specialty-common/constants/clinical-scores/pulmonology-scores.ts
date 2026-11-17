/**
 * =============================================================================
 * PULMONOLOGY CLINICAL SCORES
 * =============================================================================
 * Validated respiratory scoring instruments:
 * - GOLD Staging : COPD severity classification by FEV₁ % predicted
 * - ACT           : Asthma Control Test (5 questions)
 * =============================================================================
 */

import type { ClinicalScoreDefinition } from '../../dtos/specialty-clinic.dto';

// -----------------------------------------------------------------------------
// GOLD Staging — COPD Severity by Spirometry
// -----------------------------------------------------------------------------
export const GOLD_STAGING_SCORE: ClinicalScoreDefinition = {
  id: 'gold-copd',
  name: 'GOLD',
  full_name: 'GOLD COPD Staging (Spirometry-based)',
  specialty_codes: ['PULMONOLOGY'],
  description:
    'Classifies COPD severity using post-bronchodilator FEV₁ % predicted. Requires spirometry confirming FEV₁/FVC < 0.70.',
  items: [
    {
      id: 'gold_stage',
      question:
        'Post-bronchodilator FEV₁ % predicted (select appropriate stage):',
      options: [
        { value: 1, label: 'GOLD 1 (Mild) — FEV₁ ≥ 80% predicted' },
        { value: 2, label: 'GOLD 2 (Moderate) — FEV₁ 50–79% predicted' },
        { value: 3, label: 'GOLD 3 (Severe) — FEV₁ 30–49% predicted' },
        { value: 4, label: 'GOLD 4 (Very Severe) — FEV₁ < 30% predicted' },
      ],
    },
  ],
  max_score: 4,
  severity_ranges: [
    {
      min: 1,
      max: 1,
      label: 'GOLD 1 — Mild',
      color: '#22c55e',
      clinical_action:
        'Short-acting bronchodilator PRN. Smoking cessation. Vaccination (flu / pneumococcal). Annual spirometry.',
    },
    {
      min: 2,
      max: 2,
      label: 'GOLD 2 — Moderate',
      color: '#eab308',
      clinical_action:
        'Regular LABA or LAMA. Pulmonary rehabilitation if symptomatic. 6-monthly review.',
    },
    {
      min: 3,
      max: 3,
      label: 'GOLD 3 — Severe',
      color: '#E9783F',
      clinical_action:
        'LABA + LAMA combination. ICS if frequent exacerbations. Assess for LTOT.',
    },
    {
      min: 4,
      max: 4,
      label: 'GOLD 4 — Very Severe',
      color: '#ef4444',
      clinical_action:
        'Triple therapy (LABA/LAMA/ICS). LTOT if hypoxaemic. Consider lung transplant assessment.',
    },
  ],
  interpretation_notes:
    'GOLD staging alone does not guide full management. Also assess symptoms (CAT / mMRC), exacerbation history, and comorbidities for GOLD ABCD grouping.',
};

// -----------------------------------------------------------------------------
// ACT — Asthma Control Test
// -----------------------------------------------------------------------------
export const ACT_SCORE: ClinicalScoreDefinition = {
  id: 'act',
  name: 'ACT',
  full_name: 'Asthma Control Test (ACT)',
  specialty_codes: ['PULMONOLOGY'],
  description:
    'Measures degree of asthma control over the past 4 weeks. Five questions, each 1–5. Total: 5–25.',
  items: [
    {
      id: 'act_q1',
      question:
        'Q1 — How much of the time did your asthma keep you from getting as much done at work, school or at home?',
      options: [
        { value: 1, label: '1 — All of the time' },
        { value: 2, label: '2 — Most of the time' },
        { value: 3, label: '3 — Some of the time' },
        { value: 4, label: '4 — A little of the time' },
        { value: 5, label: '5 — None of the time' },
      ],
    },
    {
      id: 'act_q2',
      question: 'Q2 — How often have you had shortness of breath?',
      options: [
        { value: 1, label: '1 — More than once a day' },
        { value: 2, label: '2 — Once a day' },
        { value: 3, label: '3 — Three to six times a week' },
        { value: 4, label: '4 — Once or twice a week' },
        { value: 5, label: '5 — Not at all' },
      ],
    },
    {
      id: 'act_q3',
      question:
        'Q3 — How often did your asthma symptoms (wheezing, coughing, shortness of breath) wake you up at night or earlier than usual?',
      options: [
        { value: 1, label: '1 — Four or more nights a week' },
        { value: 2, label: '2 — Two or three nights a week' },
        { value: 3, label: '3 — Once a week' },
        { value: 4, label: '4 — Once or twice' },
        { value: 5, label: '5 — Not at all' },
      ],
    },
    {
      id: 'act_q4',
      question:
        'Q4 — How often have you used your rescue inhaler or nebuliser medication?',
      options: [
        { value: 1, label: '1 — Three or more times per day' },
        { value: 2, label: '2 — Once or twice per day' },
        { value: 3, label: '3 — Two or three times per week' },
        { value: 4, label: '4 — Once a week or less' },
        { value: 5, label: '5 — Not at all' },
      ],
    },
    {
      id: 'act_q5',
      question:
        'Q5 — How would you rate your asthma control during the past 4 weeks?',
      options: [
        { value: 1, label: '1 — Not controlled at all' },
        { value: 2, label: '2 — Poorly controlled' },
        { value: 3, label: '3 — Somewhat controlled' },
        { value: 4, label: '4 — Well controlled' },
        { value: 5, label: '5 — Completely controlled' },
      ],
    },
  ],
  max_score: 25,
  severity_ranges: [
    {
      min: 5,
      max: 19,
      label: 'Uncontrolled Asthma',
      color: '#ef4444',
      clinical_action:
        'Step-up therapy. Review inhaler technique and adherence. Consider GINA Step 3–5. Follow up in 4–6 weeks.',
    },
    {
      min: 20,
      max: 24,
      label: 'Partially Controlled',
      color: '#eab308',
      clinical_action:
        'Consider stepping up. Assess triggers. Review within 2–3 months.',
    },
    {
      min: 25,
      max: 25,
      label: 'Well Controlled',
      color: '#22c55e',
      clinical_action:
        'Maintain current treatment. Consider step-down if stable for 3 months.',
    },
  ],
  interpretation_notes:
    'ACT score ≥20 indicates well-controlled asthma per GINA. Score 19 or below warrants treatment review.',
};

export const PULMONOLOGY_SCORES: ClinicalScoreDefinition[] = [
  GOLD_STAGING_SCORE,
  ACT_SCORE,
];
