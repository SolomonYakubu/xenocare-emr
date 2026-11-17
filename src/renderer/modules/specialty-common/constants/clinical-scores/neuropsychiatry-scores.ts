/**
 * =============================================================================
 * NEUROPSYCHIATRY CLINICAL SCORES
 * =============================================================================
 * Validated psychiatric scoring instruments:
 * - PHQ-9  : Patient Health Questionnaire (Depression)
 * - GAD-7  : Generalized Anxiety Disorder Scale
 * - CAGE   : Alcohol abuse screening (4 items)
 * - MMSE   : Mini-Mental State Examination abridged (cognitive screen)
 * =============================================================================
 */

import type { ClinicalScoreDefinition } from '../../dtos/specialty-clinic.dto';

// -----------------------------------------------------------------------------
// PHQ-9 — Patient Health Questionnaire (Depression Severity)
// -----------------------------------------------------------------------------
export const PHQ9_SCORE: ClinicalScoreDefinition = {
  id: 'phq9',
  name: 'PHQ-9',
  full_name: 'Patient Health Questionnaire-9 (Depression)',
  specialty_codes: ['NEUROPSYCHIATRY'],
  description:
    'Screens and grades severity of depression. Ask: "Over the last 2 weeks, how often have you been bothered by any of the following problems?"',
  items: [
    {
      id: 'phq9_q1',
      question: 'Little interest or pleasure in doing things',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q2',
      question: 'Feeling down, depressed, or hopeless',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q3',
      question: 'Trouble falling or staying asleep, or sleeping too much',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q4',
      question: 'Feeling tired or having little energy',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q5',
      question: 'Poor appetite or overeating',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q6',
      question:
        'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q7',
      question:
        'Trouble concentrating on things, such as reading the newspaper or watching television',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q8',
      question:
        'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'phq9_q9',
      question:
        'Thoughts that you would be better off dead, or of hurting yourself in some way',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
  ],
  max_score: 27,
  severity_ranges: [
    {
      min: 0,
      max: 4,
      label: 'Minimal / None',
      color: '#22c55e',
      clinical_action: 'Watchful waiting. Repeat PHQ-9 as needed.',
    },
    {
      min: 5,
      max: 9,
      label: 'Mild',
      color: '#84cc16',
      clinical_action:
        'Watchful waiting. Supportive counselling. Consider follow-up in 4 weeks.',
    },
    {
      min: 10,
      max: 14,
      label: 'Moderate',
      color: '#eab308',
      clinical_action:
        'Treatment plan warranted. Consider antidepressants or psychotherapy.',
    },
    {
      min: 15,
      max: 19,
      label: 'Moderately Severe',
      color: '#E9783F',
      clinical_action:
        'Active treatment required. Antidepressants and/or psychotherapy strongly recommended.',
    },
    {
      min: 20,
      max: 27,
      label: 'Severe',
      color: '#ef4444',
      clinical_action:
        'Immediate treatment required. Consider psychiatric referral, close monitoring, and assess suicide risk.',
    },
  ],
  interpretation_notes:
    'A score of ≥10 suggests a depressive disorder. Item 9 (self-harm) should be assessed regardless of total score. Always correlate with clinical context.',
};

// -----------------------------------------------------------------------------
// GAD-7 — Generalized Anxiety Disorder Scale
// -----------------------------------------------------------------------------
export const GAD7_SCORE: ClinicalScoreDefinition = {
  id: 'gad7',
  name: 'GAD-7',
  full_name: 'Generalized Anxiety Disorder Scale-7',
  specialty_codes: ['NEUROPSYCHIATRY'],
  description:
    'Screens and grades severity of anxiety. Ask: "Over the last 2 weeks, how often have you been bothered by any of the following problems?"',
  items: [
    {
      id: 'gad7_q1',
      question: 'Feeling nervous, anxious, or on edge',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q2',
      question: 'Not being able to stop or control worrying',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q3',
      question: 'Worrying too much about different things',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q4',
      question: 'Trouble relaxing',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q5',
      question: "Being so restless that it's hard to sit still",
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q6',
      question: 'Becoming easily annoyed or irritable',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'gad7_q7',
      question: 'Feeling afraid as if something awful might happen',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
  ],
  max_score: 21,
  severity_ranges: [
    {
      min: 0,
      max: 4,
      label: 'Minimal',
      color: '#22c55e',
      clinical_action: 'Monitor; psychoeducation if appropriate.',
    },
    {
      min: 5,
      max: 9,
      label: 'Mild',
      color: '#84cc16',
      clinical_action:
        'Reassess in 4 weeks. Lifestyle interventions and relaxation techniques.',
    },
    {
      min: 10,
      max: 14,
      label: 'Moderate',
      color: '#eab308',
      clinical_action:
        'Consider pharmacotherapy (SSRI/SNRI) or structured psychotherapy (CBT).',
    },
    {
      min: 15,
      max: 21,
      label: 'Severe',
      color: '#ef4444',
      clinical_action:
        'Pharmacotherapy recommended. Consider psychiatric referral. Monitor closely.',
    },
  ],
  interpretation_notes:
    'A score ≥10 suggests GAD diagnosis. Scores ≥15 indicate severe anxiety requiring active treatment. Always rule out medical causes (thyrotoxicosis, stimulant use).',
};

// -----------------------------------------------------------------------------
// CAGE — Alcohol Abuse Screening (4 questions)
// -----------------------------------------------------------------------------
export const CAGE_SCORE: ClinicalScoreDefinition = {
  id: 'cage',
  name: 'CAGE',
  full_name: 'CAGE Alcohol Screening Questionnaire',
  specialty_codes: ['NEUROPSYCHIATRY'],
  description:
    'Rapid 4-item screen for alcohol dependence. Each "Yes" answer scores 1 point.',
  items: [
    {
      id: 'cage_q1',
      question: 'C — Have you ever felt you should Cut down on your drinking?',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'cage_q2',
      question: 'A — Have people Annoyed you by criticising your drinking?',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'cage_q3',
      question: 'G — Have you ever felt Guilty about your drinking?',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
    {
      id: 'cage_q4',
      question:
        'E — Have you ever had a drink first thing in the morning (Eye-opener) to steady your nerves or get rid of a hangover?',
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes (+1)' },
      ],
    },
  ],
  max_score: 4,
  severity_ranges: [
    {
      min: 0,
      max: 1,
      label: 'Low Risk',
      color: '#22c55e',
      clinical_action:
        'Unlikely alcohol dependence. Brief counselling if score = 1.',
    },
    {
      min: 2,
      max: 4,
      label: 'Probable Dependence',
      color: '#ef4444',
      clinical_action:
        'Highly suggestive of alcohol dependence. Full AUDIT assessment. Consider de-addiction referral.',
    },
  ],
  interpretation_notes:
    'A score of ≥2 is clinically significant. The CAGE is a screening tool only — confirm with full history and AUDIT questionnaire.',
};

// -----------------------------------------------------------------------------
// MMSE (Abridged cognitive screen — 10-item bedside version)
// -----------------------------------------------------------------------------
export const MMSE_SCORE: ClinicalScoreDefinition = {
  id: 'mmse',
  name: 'MMSE',
  full_name: 'Mini-Mental State Examination (Abridged Cognitive Screen)',
  specialty_codes: ['NEUROPSYCHIATRY'],
  description:
    'Bedside cognitive assessment. Each domain is scored based on clinician testing. Maximum total = 30.',
  items: [
    {
      id: 'mmse_orientation_time',
      question: 'Orientation to time (year, season, month, day, date) — max 5',
      options: [
        { value: 0, label: '0 — No items correct' },
        { value: 1, label: '1 correct' },
        { value: 2, label: '2 correct' },
        { value: 3, label: '3 correct' },
        { value: 4, label: '4 correct' },
        { value: 5, label: '5 correct' },
      ],
    },
    {
      id: 'mmse_orientation_place',
      question:
        'Orientation to place (country, state, city, hospital, ward) — max 5',
      options: [
        { value: 0, label: '0 — No items correct' },
        { value: 1, label: '1 correct' },
        { value: 2, label: '2 correct' },
        { value: 3, label: '3 correct' },
        { value: 4, label: '4 correct' },
        { value: 5, label: '5 correct' },
      ],
    },
    {
      id: 'mmse_registration',
      question: 'Registration (repeat 3 words: "Apple, Table, Penny") — max 3',
      options: [
        { value: 0, label: '0' },
        { value: 1, label: '1 word' },
        { value: 2, label: '2 words' },
        { value: 3, label: '3 words' },
      ],
    },
    {
      id: 'mmse_attention',
      question:
        'Attention & Calculation (Serial 7s from 100; or WORLD backwards) — max 5',
      options: [
        { value: 0, label: '0' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
      ],
    },
    {
      id: 'mmse_recall',
      question: 'Recall (3 words from registration) — max 3',
      options: [
        { value: 0, label: '0' },
        { value: 1, label: '1 word' },
        { value: 2, label: '2 words' },
        { value: 3, label: '3 words' },
      ],
    },
    {
      id: 'mmse_language',
      question:
        'Language (name 2 objects, repeat phrase, 3-step command) — max 7',
      options: [
        { value: 0, label: '0' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
        { value: 6, label: '6' },
        { value: 7, label: '7' },
      ],
    },
    {
      id: 'mmse_visuospatial',
      question: 'Visuospatial (copy intersecting pentagons) — max 1',
      options: [
        { value: 0, label: '0 — Incorrect' },
        { value: 1, label: '1 — Correct' },
      ],
    },
    {
      id: 'mmse_reading_writing',
      question:
        'Reading / Writing (read & obey "CLOSE YOUR EYES"; write a sentence) — max 2',
      options: [
        { value: 0, label: '0' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
      ],
    },
  ],
  max_score: 30,
  severity_ranges: [
    {
      min: 24,
      max: 30,
      label: 'Normal',
      color: '#22c55e',
      clinical_action:
        'No significant cognitive impairment. Monitor if borderline (24–26).',
    },
    {
      min: 18,
      max: 23,
      label: 'Mild Impairment',
      color: '#eab308',
      clinical_action:
        'Possible mild cognitive impairment. Further neuropsychological evaluation recommended.',
    },
    {
      min: 10,
      max: 17,
      label: 'Moderate Impairment',
      color: '#E9783F',
      clinical_action:
        'Moderate dementia or significant cognitive impairment. Functional assessment and carer involvement required.',
    },
    {
      min: 0,
      max: 9,
      label: 'Severe Impairment',
      color: '#ef4444',
      clinical_action:
        'Severe cognitive impairment. Comprehensive dementia workup. Capacity assessment.',
    },
  ],
  interpretation_notes:
    'Education level affects performance significantly. A 30-point perfect score does not exclude early dementia. Use for trending over time rather than single-point diagnosis.',
};

/** All neuropsychiatry scores */
export const NEUROPSYCHIATRY_SCORES: ClinicalScoreDefinition[] = [
  PHQ9_SCORE,
  GAD7_SCORE,
  CAGE_SCORE,
  MMSE_SCORE,
];
