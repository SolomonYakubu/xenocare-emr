/**
 * =============================================================================
 * CARDIOLOGY CLINICAL SCORES
 * =============================================================================
 * Validated scoring instruments for cardiology assessments:
 * - NYHA Functional Classification
 * - CHA₂DS₂-VASc Score (stroke risk in AF)
 * =============================================================================
 */

import type { ClinicalScoreDefinition } from '../../dtos/specialty-clinic.dto';

export const NYHA_SCORE: ClinicalScoreDefinition = {
  id: 'nyha',
  name: 'NYHA',
  full_name: 'New York Heart Association Functional Classification',
  specialty_codes: ['CARDIOLOGY'],
  description:
    'Classifies heart failure patients by symptom severity during physical activity.',
  items: [
    {
      id: 'nyha_class',
      question:
        "Select the class that best describes the patient's functional limitation:",
      options: [
        {
          value: 1,
          label:
            'Class I — No limitation of physical activity. Ordinary activity does not cause symptoms.',
        },
        {
          value: 2,
          label:
            'Class II — Slight limitation. Comfortable at rest. Ordinary activity causes fatigue, palpitation, or dyspnoea.',
        },
        {
          value: 3,
          label:
            'Class III — Marked limitation. Comfortable at rest. Less than ordinary activity causes symptoms.',
        },
        {
          value: 4,
          label:
            'Class IV — Unable to carry out any physical activity without discomfort. Symptoms at rest.',
        },
      ],
    },
  ],
  max_score: 4,
  severity_ranges: [
    {
      min: 1,
      max: 1,
      label: 'Class I — No limitation',
      color: '#22c55e',
      clinical_action: 'Exercise encouragement. Monitor annually.',
    },
    {
      min: 2,
      max: 2,
      label: 'Class II — Mild limitation',
      color: '#eab308',
      clinical_action: 'Optimise pharmacotherapy. 6-monthly review.',
    },
    {
      min: 3,
      max: 3,
      label: 'Class III — Marked limitation',
      color: '#E9783F',
      clinical_action:
        'Aggressive medical management. Consider device therapy. 3-monthly review.',
    },
    {
      min: 4,
      max: 4,
      label: 'Class IV — Severe limitation',
      color: '#ef4444',
      clinical_action:
        'Consider advanced therapies (LVAD, transplant). Close monitoring.',
    },
  ],
  interpretation_notes:
    'The NYHA classification is subjective and may change with treatment. Always correlate with ejection fraction and biomarkers (BNP).',
};

export const CHA2DS2_VASC_SCORE: ClinicalScoreDefinition = {
  id: 'cha2ds2-vasc',
  name: 'CHA₂DS₂-VASc',
  full_name: 'CHA₂DS₂-VASc Score for Atrial Fibrillation Stroke Risk',
  specialty_codes: ['CARDIOLOGY'],
  description:
    'Estimates stroke risk in patients with non-valvular atrial fibrillation to guide anticoagulation therapy.',
  items: [
    {
      id: 'chf',
      question: 'Congestive Heart Failure (or LVEF ≤ 40%)',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'hypertension',
      question: 'Hypertension (or on antihypertensive treatment)',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'age_75',
      question: 'Age ≥ 75 years',
      options: [
        { value: 0, label: 'No' },
        { value: 2, label: 'Yes (+2)' },
      ],
    },
    {
      id: 'diabetes',
      question: 'Diabetes Mellitus',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'stroke_tia',
      question: 'Prior Stroke / TIA / Thromboembolism',
      options: [
        { value: 0, label: 'No' },
        { value: 2, label: 'Yes (+2)' },
      ],
    },
    {
      id: 'vascular',
      question: 'Vascular disease (prior MI, PAD, aortic plaque)',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'age_65_74',
      question: 'Age 65–74 years',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'sex_female',
      question: 'Sex category (Female)',
      options: [
        { value: 0, label: 'Male' },
        { value: 1, label: 'Female (+1)' },
      ],
    },
  ],
  max_score: 9,
  severity_ranges: [
    {
      min: 0,
      max: 0,
      label: 'Low Risk',
      color: '#22c55e',
      clinical_action:
        'No anticoagulation needed (consider aspirin or nothing).',
    },
    {
      min: 1,
      max: 1,
      label: 'Low–Moderate Risk',
      color: '#eab308',
      clinical_action:
        'Consider oral anticoagulation (OAC). Discuss risks/benefits with patient.',
    },
    {
      min: 2,
      max: 9,
      label: 'Moderate–High Risk',
      color: '#ef4444',
      clinical_action:
        'Oral anticoagulation recommended (DOAC preferred over warfarin unless mechanical valve).',
    },
  ],
  interpretation_notes:
    'A score of 0 in males or 1 in females (where the only point is sex) is considered low risk. ' +
    'Always assess bleeding risk (HAS-BLED) alongside stroke risk before initiating anticoagulation.',
};

/** All cardiology scores */
export const CARDIOLOGY_SCORES: ClinicalScoreDefinition[] = [
  NYHA_SCORE,
  CHA2DS2_VASC_SCORE,
];
