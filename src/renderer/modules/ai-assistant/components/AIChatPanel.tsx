/**
 * AIChatPanel — main AI Clinical Assistant panel.
 *
 * Features:
 * - Expandable width (admin can toggle wider view)
 * - Patient context header with embedding sync status
 * - Friendly welcome screen with collapsible quick-start prompts
 * - Chat-style conversation with user/assistant bubbles
 * - Animated typing indicator
 * - Tabbed views: Chat | Trends | Completeness | Coding
 * - Clear conversation action
 */
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  Globe,
  X,
  Minimize2,
  Shrink,
  Expand,
  Trash2,
  RefreshCw,
  Loader2,
  MessageSquare,
  Activity,
  ClipboardCheck,
  Tag,
  Sparkles,
  Stethoscope,
  Heart,
  FlaskConical,
  FileText,
  Syringe,
  BedDouble,
  ScanLine,
  Plus,
  Clock3,
} from 'lucide-react';

import { AIQueryInput } from './AIQueryInput';
import { AIResponseCard } from './AIResponseCard';
import { AIEncounterBrief } from './AIEncounterBrief';
import { AITrendInsights } from './AITrendInsights';
import { AICompletenessScore } from './AICompletenessScore';
import { AICodingSuggestions } from './AICodingSuggestions';
import { AIDisclaimer } from './AIDisclaimer';

import { useAIConfig, useAIHealth } from '../hooks/useAIQuery';
import { useAITrends } from '../hooks/useAITrends';
import { useAICompleteness } from '../hooks/useAICompleteness';
import { useEmbeddingSync } from '../hooks/useEmbeddingSync';
import { queryAIStream, onStreamChunk } from '../api/ai.api';
import {
  getSyncMetaValue,
  removeSyncMetaValue,
  setSyncMetaValue,
} from '../../../lib/offline/storage/persistence';

import type {
  AIAssistantScope,
  AIQueryRequest,
  AIResponse,
} from '../types/ai.types';

// =============================================================================
// Types
// =============================================================================

interface ConversationEntry {
  id: string;
  query: string;
  response: AIResponse;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  assistantScope: AIAssistantScope;
  patientId: string | null;
  messages: ConversationEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMarkdownValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (value == null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeMarkdownValue(entry).trim())
      .filter(Boolean)
      .join('\n\n');
  }

  if (isRecord(value)) {
    for (const key of ['answer', 'content', 'text', 'message']) {
      const candidate = value[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    const sectionBlocks = Object.entries(value)
      .map(([key, sectionValue]) => {
        const body = normalizeMarkdownValue(sectionValue).trim();
        if (!body) {
          return null;
        }

        const heading = key
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        return `### ${heading}\n${body}`;
      })
      .filter((block): block is string => Boolean(block));

    if (sectionBlocks.length > 0) {
      return sectionBlocks.join('\n\n');
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return String(value);
}

function normalizeAIResponsePayload(response: unknown): AIResponse {
  if (!isRecord(response)) {
    return {
      answer: normalizeMarkdownValue(response),
      sources: [],
      confidence: 'LOW',
    };
  }

  const normalized: AIResponse = {
    answer: normalizeMarkdownValue(response.answer),
    sources: Array.isArray(response.sources)
      ? (response.sources as AIResponse['sources'])
      : [],
  };

  if (
    response.confidence === 'LOW' ||
    response.confidence === 'MEDIUM' ||
    response.confidence === 'HIGH'
  ) {
    normalized.confidence = response.confidence;
  }

  if (typeof response.model === 'string') {
    normalized.model = response.model;
  }

  if (typeof response.searchType === 'string') {
    normalized.searchType = response.searchType;
  }

  if (typeof response.resultCount === 'number') {
    normalized.resultCount = response.resultCount;
  }

  if (typeof response.responseTimeMs === 'number') {
    normalized.responseTimeMs = response.responseTimeMs;
  }

  if (
    typeof response.tokensUsed === 'number' ||
    isRecord(response.tokensUsed)
  ) {
    normalized.tokensUsed = response.tokensUsed as AIResponse['tokensUsed'];
  }

  if (isRecord(response.sections)) {
    normalized.sections = response.sections as AIResponse['sections'];
  }

  if (Array.isArray(response.citations)) {
    normalized.citations = response.citations as AIResponse['citations'];
  }

  return normalized;
}

function normalizeConversationEntry(
  entry: unknown,
  fallbackId: string,
): ConversationEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const query = normalizeMarkdownValue(entry.query).trim();
  const response = normalizeAIResponsePayload(entry.response);

  if (!query && !response.answer.trim()) {
    return null;
  }

  return {
    id: typeof entry.id === 'string' ? entry.id : fallbackId,
    query: query || 'Previous query',
    response,
    timestamp:
      typeof entry.timestamp === 'string'
        ? entry.timestamp
        : new Date().toISOString(),
  };
}

interface AIChatPanelProps {
  patientId: string | null;
  encounterId?: string;
  assistantScope?: AIAssistantScope;
  patientName?: string;
  emrNumber?: string;
  facilityId?: string;
  userId?: string;
  chiefComplaint?: string;
  department?: string;
  visitDate?: string;
  consultationData?: Record<string, unknown> | null;
  existingCodes?: string[];
  onClose?: () => void;
  onAddCode?: (code: string, description: string) => void;
  onExpandToggle?: (expanded: boolean) => void;
  variant?: 'full' | 'minimal';
  className?: string;
}

type TabKey = 'chat' | 'trends' | 'completeness' | 'coding';

const TABS: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'chat', label: 'Chat', Icon: MessageSquare },
  { key: 'trends', label: 'Trends', Icon: Activity },
  { key: 'completeness', label: 'Docs', Icon: ClipboardCheck },
  { key: 'coding', label: 'Coding', Icon: Tag },
];

type BrowseWorkflow = {
  icon: React.ElementType;
  label: string;
  query: string;
  color: string;
  bg: string;
};

// ── Records-office workflows for clinical scope ──
const CLINICAL_RECORDS_WORKFLOWS: BrowseWorkflow[] = [
  {
    icon: Sparkles,
    label: 'Entire Hospital Visits Summary',
    query:
      "Provide a summary of this patient's entire hospital visits summary with vitals table, consultations table, labs table, timeline, inconsistencies, findings, recommendations, and confidence.",
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'hover:bg-violet-50 dark:hover:bg-violet-900/20',
  },
  {
    icon: Stethoscope,
    label: 'Chart Summary',
    query:
      'Prepare a complete chart summary for this patient from all available records and highlight missing documentation before clinical use.',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
  },
  {
    icon: Globe,
    label: 'Standards Mapping (FHIR/ICD/LOINC)',
    query:
      'Map available EMR records to international standards (HL7 FHIR, ICD-10, SNOMED CT, LOINC, RxNorm, SOAP/POMR), show aligned fields, unmapped gaps, and practical fixes for documentation quality.',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
  },
  {
    icon: Globe,
    label: 'Embedding-Ready Records Pack',
    query:
      'Prepare ALL patient-related medical records across the EMR for embedding preparation only (do NOT generate embeddings). Include all available modules and return structured records with: patient_id, encounter_id, source_table, source_id, chunk_text, chunk_type, record_date, metadata. Ensure semantic chunking, full coverage, consistency, latest-state handling, and no duplicate content.',
    color: 'text-lime-700 dark:text-lime-400',
    bg: 'hover:bg-lime-50 dark:hover:bg-lime-900/20',
  },
  {
    icon: FileText,
    label: 'Encounter Traceability',
    query:
      'Trace encounter history and verify encounter linkage consistency using visit_id, current_stage, status, chief_complaint, and attending doctor.',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'hover:bg-slate-50 dark:hover:bg-slate-900/20',
  },
  {
    icon: FlaskConical,
    label: 'Lab Evidence Review',
    query:
      'Review all lab records and produce an evidence summary with abnormalities, trend concerns, and missing test follow-up requirements.',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  {
    icon: Syringe,
    label: 'Medication Safety Audit',
    query:
      'Audit medication records against known_allergies, diagnosis context, and continuity of care. Identify conflicts, missing dose details, or unresolved medication statuses.',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20',
  },
  {
    icon: Activity,
    label: 'Vitals Trend Integrity',
    query:
      'Evaluate vitals timeline for this patient and flag critical values, deterioration trends, and data-quality gaps in date_recorded, blood_pressure, pulse, respiratory_rate, temperature, oxygen_saturation, and blood_glucose.',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  {
    icon: BedDouble,
    label: 'Admission/Discharge Audit',
    query:
      'Compile admission and discharge records with admitting diagnosis, discharge diagnosis, ward movement, physician/nurse attribution, discharge summary, and discharge medication completeness checks.',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
  },
  {
    icon: ScanLine,
    label: 'Imaging & Procedure Cross-check',
    query:
      'Cross-check radiology/procedure records against encounter timeline and referrals; surface missing reports, inconsistencies, and unresolved findings.',
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
  },
  {
    icon: Heart,
    label: 'Records Office Request Pack',
    query:
      'Prepare a medical records office release/continuity pack: demographics, encounter timeline, vitals, consultations, labs, medications, admissions, referrals, nursing notes, and explicit missing fields required before release.',
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'hover:bg-pink-50 dark:hover:bg-pink-900/20',
  },
];

const PHARMACY_WORKFLOWS: BrowseWorkflow[] = [
  {
    icon: Syringe,
    label: 'Dispensing Queue Status',
    query:
      'Summarize dispensing queue bottlenecks, pending verifications, and top actionable pharmacy tasks right now.',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20',
  },
  {
    icon: FlaskConical,
    label: 'Stock & Expiry Risk',
    query:
      'Show stock-out and near-expiry risk overview for active pharmacy inventory with immediate actions.',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  {
    icon: Activity,
    label: 'Financial Snapshot',
    query:
      'Provide a concise pharmacy financial snapshot from available records: paid, pending, and disputed items.',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
];

const CHAT_HISTORY_VERSION = 'v1';
const MAX_CHAT_SESSIONS = 40;
const MAX_MESSAGES_PER_SESSION = 50;
const CONTEXT_TURNS_LIMIT = 6;
const CLIENT_MIN_SUBMIT_INTERVAL_MS = 1200;
const CLIENT_STREAM_REQUEST_TIMEOUT_MS = 120000;

const HOSPITAL_VISIT_SUMMARY_INTENT =
  /(entire|complete|full|all)\s+(hospital|visit|chart|patient)\s*(visit|visits|summary|history|timeline)|hospital\s+visits?\s+summary|patient\s+snapshot|visit\s+trajectory/i;

const GLOBAL_CLINICAL_INTENT =
  /\b(all\s+patients?|every\s+patient|across\s+(all\s+)?patients?|all\s+medical\s+records?|full\s+detailed\s+clinical\s+records?|hospital\s*[- ]?wide|entire\s+emr|whole\s+emr|all\s+(encounters?|visits?|charts?)|global\s+(clinical|summary|report)|population\s*[- ]?level|system\s*[- ]?wide|any\s+patients?\s+records?|all\s+at\s+once)\b/i;

function isHospitalVisitSummaryQuery(query: string): boolean {
  return HOSPITAL_VISIT_SUMMARY_INTENT.test(query);
}

function isGlobalClinicalIntentQuery(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return GLOBAL_CLINICAL_INTENT.test(normalized);
}

const EMBEDDING_PREP_INTENT =
  /\b(prepare\s+.*for\s+embedding|ready\s+for\s+embedding|embedding\s+input|chunk_text|chunk_type|source_table|source_id|full\s+coverage\s+guarantee|do\s+not\s+generate\s+embeddings|all\s+modules|structured\s+records|patient\s*[- ]?related\s+medical\s+records|medical\s+data\s+processing\s+ai|all\s+patients?\s+medical\s+history)\b/i;

function isEmbeddingPreparationQuery(query: string): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return EMBEDDING_PREP_INTENT.test(normalized);
}

function adaptClinicalWorkflowQueryForScope(
  query: string,
  isGlobalMode: boolean,
): string {
  if (!isGlobalMode) return query;

  return query
    .replace(/\bthis patient's\b/gi, 'all patients')
    .replace(/\bthis patient\b/gi, 'all patients')
    .replace(/\bfor this patient\b/gi, 'across all patients')
    .replace(/\bpatient timeline\b/gi, 'cross-patient timeline');
}

function getHospitalVisitSummaryTemplate(): string {
  return [
    '## Patient Snapshot',
    '- **Name**: <full name> / **EMR**: <emr number> / **Sex**: <sex> / **Age**: <age>',
    '- **Current Encounter ID**: <id> / **Stage**: <stage>',
    '- **Active Problem Focus**: <top current problem list>',
    '- **Top Risk Flags**: <comma-separated risk flags>',
    '',
    '## Vitals (Table)',
    '| Date | BP | HR | RR | Temp | SpO2 | Notes |',
    '|------|----|----|----|------|------|-------|',
    '| <date> | <bp> | <hr> | <rr> | <temp> | <spo2> | <notes> |',
    '',
    '## Consultations (Table)',
    '| Date | Encounter ID | Clinician | Key Assessment | Plan | Status |',
    '|------|--------------|-----------|----------------|------|--------|',
    '| <date> | <encounter> | <clinician> | <assessment> | <plan> | <status> |',
    '',
    '## Lab Results (Table)',
    '| Date | Test | Result | Reference Range | Status | Clinical Note |',
    '|------|------|--------|------------------|--------|---------------|',
    '| <date or 📭> | <test> | <result> | <range> | <status> | <note> |',
    '',
    '## Patient Timeline',
    '- <dated key event 1>',
    '- <dated key event 2>',
    '',
    '## Key Findings',
    '- <fact 1 grounded in chart>',
    '- <fact 2 grounded in chart>',
    '',
    '## Missing/Conflicting Records',
    '- ❌ <missing/conflicting record 1>',
    '- ❌ <missing/conflicting record 2>',
    '',
    '## Recommended Next Action',
    '- **Clinician**: <action>',
    '- **Nurse**: <action>',
    '- **Records Office**: <action>',
    '- **Billing Desk**: <action>',
    '',
    '## Records Office Prompt Checklist',
    '1. ✅ Context dataset is internally consistent',
    '2. ❌ Cross-check labs module for missing hematology/chemistry results',
    '3. ❌ Verify pharmacy module for prescribed medications',
    '4. ❌ Confirm radiology module access if imaging was performed',
    '5. ❌ Validate nursing module for complete vital signs logs',
    '',
    '## Data Quality Notice',
    '- <quality limitations impacting reliability>',
    '',
    '## Confidence',
    '<High/Medium/Low with one-line reason>',
  ].join('\n');
}

type CanonicalHospitalSection = {
  heading: string;
  aliases: string[];
  fallback: string;
};

const CANONICAL_HOSPITAL_SUMMARY_SECTIONS: CanonicalHospitalSection[] = [
  {
    heading: '## Patient Snapshot',
    aliases: ['patient snapshot'],
    fallback: '- Name: Unknown\n- EMR: Unknown\n- Current Encounter: Unknown',
  },
  {
    heading: '## Vitals (Table)',
    aliases: ['vitals (table)', 'vitals'],
    fallback:
      '| Date | BP | HR | RR | Temp | SpO2 | Notes |\n|------|----|----|----|------|------|-------|\n| 📭 | - | - | - | - | - | No vitals found |',
  },
  {
    heading: '## Consultations (Table)',
    aliases: ['consultations (table)', 'consultations'],
    fallback:
      '| Date | Encounter ID | Clinician | Key Assessment | Plan | Status |\n|------|--------------|-----------|----------------|------|--------|\n| 📭 | - | - | No consultation records found | - | - |',
  },
  {
    heading: '## Lab Results (Table)',
    aliases: ['lab results (table)', 'lab results', 'labs'],
    fallback:
      '| Date | Test | Result | Reference Range | Status | Clinical Note |\n|------|------|--------|------------------|--------|---------------|\n| 📭 | - | - | - | - | No lab results found in chart |',
  },
  {
    heading: '## Patient Timeline',
    aliases: ['patient timeline', 'timeline'],
    fallback: '- No clear timeline events found in available records.',
  },
  {
    heading: '## Missing/Conflicting Records',
    aliases: [
      'missing/conflicting records',
      'missing records',
      'data inconsistencies',
      'inconsistencies',
    ],
    fallback: '- ⚠️ Missing structured fields in chart data.',
  },
  {
    heading: '## Key Findings',
    aliases: ['key findings', 'findings'],
    fallback:
      '- Chart evidence is limited; clinical interpretation is constrained.',
  },
  {
    heading: '## Recommended Next Action',
    aliases: [
      'recommended next action',
      'next action',
      'clinical recommendation',
      'recommendations',
    ],
    fallback: '- Collect missing core records before clinical decisions.',
  },
  {
    heading: '## Records Office Prompt Checklist',
    aliases: ['records office prompt checklist', 'records office checklist'],
    fallback:
      '1. ✅ Context dataset reviewed\n2. ❌ Labs cross-check pending\n3. ❌ Pharmacy cross-check pending\n4. ❌ Radiology cross-check pending\n5. ❌ Nursing logs cross-check pending',
  },
  {
    heading: '## Data Quality Notice',
    aliases: ['data quality notice', 'data quality'],
    fallback:
      '- Data reliability is reduced by missing or placeholder documentation.',
  },
  {
    heading: '## Confidence',
    aliases: ['confidence'],
    fallback: 'Medium-Low - chart data is incomplete.',
  },
];

function normalizeHeadingKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[`*#:_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarkdownSections(
  markdown: string,
): Array<{ heading: string; body: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];

  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line.trim())) {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
        });
      }
      currentHeading = line.trim();
      currentBody = [];
      continue;
    }
    if (currentHeading) {
      currentBody.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    });
  }

  return sections;
}

function normalizeHospitalVisitSummaryAnswer(
  query: string,
  answer: string,
): string {
  if (!isHospitalVisitSummaryQuery(query)) return answer;
  if (!answer || !answer.trim()) {
    return getHospitalVisitSummaryTemplate();
  }

  const parsed = parseMarkdownSections(answer);
  if (parsed.length === 0) {
    return [
      '## Patient Snapshot',
      '- Name: Unknown',
      '- EMR: Unknown',
      '',
      '## Key Findings',
      answer.trim(),
      '',
      ...CANONICAL_HOSPITAL_SUMMARY_SECTIONS.filter(
        (section) =>
          section.heading !== '## Patient Snapshot' &&
          section.heading !== '## Key Findings',
      ).map((section) => `${section.heading}\n${section.fallback}`),
    ].join('\n\n');
  }

  const byHeading = new Map<string, string>();

  for (const section of parsed) {
    const key = normalizeHeadingKey(section.heading.replace(/^#{2,3}\s+/, ''));
    if (!byHeading.has(key)) {
      byHeading.set(key, section.body);
    }
  }

  const hasAllSections = CANONICAL_HOSPITAL_SUMMARY_SECTIONS.every(
    (section) => {
      return section.aliases.some((alias) =>
        byHeading.has(normalizeHeadingKey(alias)),
      );
    },
  );

  if (hasAllSections) {
    return answer;
  }

  const normalizedBlocks = CANONICAL_HOSPITAL_SUMMARY_SECTIONS.map(
    (section) => {
      const body = section.aliases
        .map((alias) => byHeading.get(normalizeHeadingKey(alias)))
        .find((candidate) => Boolean(candidate && candidate.trim()));

      return `${section.heading}\n${body?.trim() || section.fallback}`;
    },
  );

  return normalizedBlocks.join('\n\n');
}

function createSessionId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deriveChatTitle(query: string): string {
  const compact = query.replace(/\s+/g, ' ').trim();
  if (!compact) return 'New chat';
  if (compact.length <= 52) return compact;
  return `${compact.slice(0, 52)}...`;
}

function formatLastUpdated(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function sortSessionsByRecent(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => {
    const aTs = new Date(a.updatedAt).getTime();
    const bTs = new Date(b.updatedAt).getTime();
    return bTs - aTs;
  });
}

function extractRecordsOfficeChecklist(
  consultationData?: Record<string, unknown> | null,
): string[] {
  if (!consultationData) {
    return [
      'Patient demographics verification',
      'Encounter timeline completeness (visit_id, status, current_stage)',
      'Clinical evidence set (vitals, labs, imaging, medications/allergies)',
      'Discharge/referral documentation completeness',
      'Billing documentation validation',
    ];
  }

  const checklist: string[] = [];
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(consultationData, key);

  if (!has('patient_name') || !has('emr_number')) {
    checklist.push('Verify demographic identifiers (patient_name, emr_number)');
  }
  if (!has('total_encounters') || !has('latest_encounter')) {
    checklist.push(
      'Validate encounter continuity (total_encounters, latest_encounter)',
    );
  }
  if (!has('chief_complaints') || !has('visit_types')) {
    checklist.push(
      'Review presenting history completeness (chief_complaints, visit_types)',
    );
  }
  if (!has('status_breakdown') || !has('stage_breakdown')) {
    checklist.push(
      'Confirm workflow integrity (status_breakdown, stage_breakdown)',
    );
  }
  if (!has('clinic_history') || !has('attending_doctors')) {
    checklist.push(
      'Confirm care attribution (clinic_history, attending_doctors)',
    );
  }

  return checklist.length > 0
    ? checklist
    : [
        'Context dataset complete; verify external modules (labs/radiology/pharmacy/nursing) for cross-module consistency.',
      ];
}

function compactContextForPrompt(
  consultationData?: Record<string, unknown> | null,
): string {
  if (!consultationData) return 'No encounter context snapshot provided.';

  const compact = {
    patient_name: consultationData.patient_name,
    emr_number: consultationData.emr_number,
    total_encounters: consultationData.total_encounters,
    first_visit_date: consultationData.first_visit_date,
    latest_visit_date: consultationData.latest_visit_date,
    latest_encounter: consultationData.latest_encounter,
    visit_types: consultationData.visit_types,
    priority_breakdown: consultationData.priority_breakdown,
    status_breakdown: consultationData.status_breakdown,
    stage_breakdown: consultationData.stage_breakdown,
    chief_complaints: consultationData.chief_complaints,
    clinic_history: consultationData.clinic_history,
    attending_doctors: consultationData.attending_doctors,
  };

  const serialized = JSON.stringify(compact);
  if (serialized.length <= 2500) return serialized;
  return `${serialized.slice(0, 2500)}...`;
}

function buildSocraticClinicalQuery(
  originalQuery: string,
  context: {
    patientName?: string;
    emrNumber?: string;
    encounterId?: string;
    chiefComplaint?: string;
    consultationData?: Record<string, unknown> | null;
  },
  options?: {
    globalMode?: boolean;
  },
): string {
  const isGlobalMode = options?.globalMode === true;
  const isEmbeddingPreparationMode = isEmbeddingPreparationQuery(originalQuery);
  const contextHeader = [
    !isGlobalMode && context.patientName
      ? `Patient Name: ${context.patientName}`
      : null,
    !isGlobalMode && context.emrNumber
      ? `Patient number: ${context.emrNumber}`
      : null,
    !isGlobalMode && context.encounterId
      ? `Encounter ID: ${context.encounterId}`
      : null,
    !isGlobalMode && context.chiefComplaint
      ? `Chief Complaint: ${context.chiefComplaint}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const recordsOfficeChecklist = (
    isGlobalMode
      ? [
          'Validate patient identifiers and deduplicate cross-patient records.',
          'Summarize encounter, consultation, labs, imaging, pharmacy, and billing coverage by module.',
          'Flag missing modules/fields needed for standards-compliant reporting and continuity of care.',
          'Separate chart-grounded findings from best-practice guidance.',
        ]
      : extractRecordsOfficeChecklist(context.consultationData)
  )
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n');

  const contextSnapshot = isGlobalMode
    ? 'Global mode selected. Analyze across available patient records, encounters, labs, imaging, medications, procedures, admissions, referrals, nursing notes, and billing data.'
    : compactContextForPrompt(context.consultationData);
  const needsHospitalVisitSummaryFormat =
    !isGlobalMode &&
    !isEmbeddingPreparationMode &&
    isHospitalVisitSummaryQuery(originalQuery);
  const strictSummaryTemplate = getHospitalVisitSummaryTemplate();
  const embeddingPreparationInstructions = [
    'EMBEDDING PREPARATION MODE:',
    '- Do NOT generate embeddings. Only prepare semantically rich, structured clinical text records.',
    '- Include all available modules: demographics, encounters/visits, consultations, diagnoses, procedures, medications/prescriptions, pharmacy/dispensing, labs, radiology/imaging, vitals, allergies, immunizations, and documents/attachments where present.',
    '- Preserve context in each chunk: what happened, when it happened, and clinical significance.',
    '- Use logical chunking. Each chunk must remain clinically meaningful on its own.',
    '- Link each chunk to identifiers: patient_id, encounter_id (if applicable), source_table, source_id.',
    '- Attach metadata fields where available: diagnosis, procedure_type, medication_class, lab_category, severity/status.',
    '- Reflect the most recent state of records and avoid stale/outdated duplicate content.',
    '- Avoid duplicate chunk text for the same source unless there is materially new clinical information.',
    '- Output must be consistent and standardized across modules.',
    '',
    'REQUIRED OUTPUT FORMAT (markdown table or JSON array):',
    '- patient_id',
    '- encounter_id',
    '- source_table',
    '- source_id',
    '- chunk_text',
    '- chunk_type',
    '- record_date',
    '- metadata',
  ].join('\n');

  return [
    'Generate a chart-grounded clinical response using only available EMR evidence.',
    'Keep reasoning internal; do not reveal process narration or methodology labels in the final answer.',
    'Do not include the words "Socratic", "thinking process", "reasoning process", or "objective" as section headings in the visible response.',
    'Return data-first output. Start directly with patient/visit data sections.',
    'Tie findings to EMR fields/records where available: patient demographics, visits/encounters, current_stage, chief_complaint, vitals, consultations, nursing notes, lab/imaging results, medications/allergies, procedures, admissions/discharge, referrals, billing metadata.',
    'When asked about standards, map findings to international EMR standards and coding systems where relevant (HL7 FHIR, ICD-10, SNOMED CT, LOINC, RxNorm, SOAP/POMR) and clearly label standards guidance versus chart evidence.',
    'If records are missing, explicitly list exact missing fields and who should provide them (clinician, nurse, records office, billing).',
    isEmbeddingPreparationMode
      ? 'For this request, prioritize exhaustive structured extraction across records over narrative summarization.'
      : 'Output sections should be concise and clinical, with tables where relevant.',
    needsHospitalVisitSummaryFormat
      ? 'For this request, you MUST return the response in the exact markdown structure below. Keep section order unchanged and do not omit headings.'
      : 'Prefer concise structured markdown with headings and tables where appropriate.',
    needsHospitalVisitSummaryFormat
      ? `Strict Hospital Visit Summary Template:\n${strictSummaryTemplate}`
      : null,
    isEmbeddingPreparationMode ? embeddingPreparationInstructions : null,
    isGlobalMode
      ? 'Context: Global clinical query across multiple patients. Do not narrow to a single chart unless explicitly requested.'
      : contextHeader
        ? `Context: ${contextHeader}`
        : 'Context: Patient-specific clinical query.',
    `Encounter Context Snapshot: ${contextSnapshot}`,
    `Records Office Checklist:\n${recordsOfficeChecklist}`,
    `User Query: ${originalQuery}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

// Typing indicator animation
function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 px-1">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <div
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <div
            className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Searching records & generating response…
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function AIChatPanel({
  patientId,
  encounterId,
  assistantScope = 'clinical',
  patientName = 'Unknown Patient',
  emrNumber,
  facilityId = '',
  userId = '',
  chiefComplaint,
  department,
  visitDate,
  consultationData = null,
  existingCodes = [],
  onClose,
  onAddCode,
  onExpandToggle,
  variant = 'full',
  className = '',
}: AIChatPanelProps) {
  const isMinimal = variant === 'minimal';
  const isClinicalScope = assistantScope === 'clinical';
  const [clinicalScopeMode, setClinicalScopeMode] = useState<
    'patient' | 'global'
  >(patientId ? 'patient' : 'global');

  useEffect(() => {
    if (!isClinicalScope) return;
    if (!patientId) {
      setClinicalScopeMode('global');
    }
  }, [isClinicalScope, patientId]);

  const isGlobalClinicalMode =
    isClinicalScope && (clinicalScopeMode === 'global' || !patientId);
  const effectivePatientId = isGlobalClinicalMode ? null : patientId;

  const storageKey = useMemo(
    () =>
      [
        'ndc-ai-chat-history',
        CHAT_HISTORY_VERSION,
        assistantScope,
        effectivePatientId || 'global',
        facilityId || 'facility',
        userId || 'user',
      ].join(':'),
    [assistantScope, effectivePatientId, facilityId, userId],
  );

  const createChatSession = useCallback(
    (seedQuery?: string): ChatSession => {
      const now = new Date().toISOString();
      return {
        id: createSessionId(),
        title: seedQuery ? deriveChatTitle(seedQuery) : 'New chat',
        createdAt: now,
        updatedAt: now,
        assistantScope,
        patientId: effectivePatientId || null,
        messages: [],
      };
    },
    [assistantScope, effectivePatientId],
  );

  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [isMinimised, setIsMinimised] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [pendingQuery, setPendingQuery] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const canQueryWithoutPatient =
    assistantScope === 'pharmacy' || isGlobalClinicalMode;
  const browseWorkflows = useMemo(
    () =>
      assistantScope === 'clinical'
        ? CLINICAL_RECORDS_WORKFLOWS
        : PHARMACY_WORKFLOWS,
    [assistantScope],
  );
  const canSubmitQueries = !!effectivePatientId || canQueryWithoutPatient;
  const activeSession = useMemo(
    () =>
      chatSessions.find((session) => session.id === activeSessionId) || null,
    [chatSessions, activeSessionId],
  );
  const conversation = activeSession?.messages || [];

  // ── Hooks ──
  const aiHealth = useAIHealth(true);
  const aiConfig = useAIConfig(true);
  const syncStatus = useEmbeddingSync(effectivePatientId);
  const { data: trends, isLoading: trendsLoading } = useAITrends({
    patientId: patientId || '',
    enabled: activeTab === 'trends' && !!patientId,
  });
  const completenessScore = useAICompleteness(consultationData as any);

  const { blockingReadinessIssues, advisoryReadinessIssues } = useMemo(() => {
    const blocking: string[] = [];
    const advisory: string[] = [];

    if (aiHealth.error) {
      blocking.push(
        `AI health check failed: ${aiHealth.error.message || 'unknown error'}`,
      );
      return {
        blockingReadinessIssues: blocking,
        advisoryReadinessIssues: advisory,
      };
    }

    const health = aiHealth.data;
    if (!health) {
      return {
        blockingReadinessIssues: blocking,
        advisoryReadinessIssues: advisory,
      };
    }

    if (!health.supabaseConfigured) {
      blocking.push(
        'Supabase AI backend is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY, then run the AI assistant migrations.',
      );
    }

    if (!health.configured) {
      if (health.provider === 'openai') {
        blocking.push(
          'OpenAI is selected but OPENAI_API_KEY is missing in the main-process environment.',
        );
      } else if (health.provider === 'gemini') {
        blocking.push(
          'Gemini is selected but GEMINI_API_KEY is missing in the main-process environment.',
        );
      } else if (health.provider === 'groq') {
        blocking.push(
          'Groq is selected but GROQ_API_KEY is missing in the main-process environment.',
        );
      } else {
        blocking.push(
          `Ollama is selected but no reachable base URL is configured. Expected ${aiConfig.data?.ollamaBaseUrl || 'http://localhost:11434'}.`,
        );
      }
    } else if (!health.llmReachable) {
      if (health.provider === 'ollama') {
        blocking.push(
          `Ollama is not reachable at ${aiConfig.data?.ollamaBaseUrl || 'http://localhost:11434'}. Start Ollama and pull ${aiConfig.data?.chatModel || 'the configured chat model'}.`,
        );
      } else {
        blocking.push(
          `${health.provider.toUpperCase()} is configured but the chat model could not be reached. Check the API key, network access, and provider quota/model availability.`,
        );
      }
    }

    if (!health.embeddingReachable) {
      advisory.push(
        `Embeddings are unavailable. Hybrid and vector search will stay degraded until ${aiConfig.data?.embeddingModel || 'the configured embedding backend'} is reachable.`,
      );
    }

    return {
      blockingReadinessIssues: blocking,
      advisoryReadinessIssues: advisory,
    };
  }, [aiConfig.data, aiHealth.data, aiHealth.error]);
  const canRunAIQueries = canSubmitQueries && blockingReadinessIssues.length === 0;

  // ── Auto-scroll on new messages or streaming text ──
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, streamingText]);

  // Load chat sessions from IndexedDB for this scope + patient context.
  useEffect(() => {
    let mounted = true;

    const restoreSessions = async (): Promise<void> => {
      try {
        const stored = await getSyncMetaValue<ChatSession[]>(storageKey);
        if (!mounted || !Array.isArray(stored) || stored.length === 0) {
          const fresh = createChatSession();
          if (!mounted) return;
          setChatSessions([fresh]);
          setActiveSessionId(fresh.id);
          return;
        }

        const persistedSessions = stored as Array<
          Partial<ChatSession> & Record<string, unknown>
        >;

        const validSessions: ChatSession[] = persistedSessions
          .filter((session) => session && typeof session.id === 'string')
          .map((session): ChatSession => {
            const sessionId =
              typeof session.id === 'string'
                ? session.id
                : `restored-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const createdAt =
              typeof session.createdAt === 'string'
                ? session.createdAt
                : new Date().toISOString();
            const updatedAt =
              typeof session.updatedAt === 'string'
                ? session.updatedAt
                : createdAt;
            const title =
              typeof session.title === 'string' && session.title.trim()
                ? session.title
                : 'New chat';
            const assistantScopeValue: AIAssistantScope =
              session.assistantScope === 'pharmacy'
                ? 'pharmacy'
                : 'clinical';
            const messages = Array.isArray(session.messages)
              ? session.messages
                  .map((entry, entryIndex) =>
                    normalizeConversationEntry(
                      entry,
                      `${sessionId}-${entryIndex}`,
                    ),
                  )
                  .filter((entry): entry is ConversationEntry => entry !== null)
              : [];

            return {
              id: sessionId,
              assistantScope: assistantScopeValue,
              patientId:
                typeof session.patientId === 'string' ? session.patientId : null,
              messages,
              title,
              createdAt,
              updatedAt,
            };
          })
          .slice(0, MAX_CHAT_SESSIONS);

        const sorted = sortSessionsByRecent(validSessions);
        if (!mounted) return;
        setChatSessions(sorted);
        setActiveSessionId(sorted[0]?.id || null);
      } catch {
        if (!mounted) return;
        const fresh = createChatSession();
        setChatSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    };

    void restoreSessions();

    return () => {
      mounted = false;
    };
  }, [storageKey, createChatSession]);

  // Persist chat sessions.
  useEffect(() => {
    if (chatSessions.length === 0) return;
    void setSyncMetaValue(storageKey, chatSessions.slice(0, MAX_CHAT_SESSIONS));
  }, [chatSessions, storageKey]);

  // ── Clean up stream listener on unmount ──
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.();
    };
  }, []);

  // ── Submit Query (Streaming) ──
  const handleSubmit = useCallback(
    (
      query: string,
      searchType?: 'hybrid' | 'fulltext' | 'vector',
      imageAttachments?: AIQueryRequest['imageAttachments'],
    ) => {
      if (!canSubmitQueries || isStreaming) return;

      if (blockingReadinessIssues.length > 0) {
        setStreamError(blockingReadinessIssues[0]);
        return;
      }

      const now = Date.now();
      if (now - lastSubmitAt < CLIENT_MIN_SUBMIT_INTERVAL_MS) {
        setStreamError('Please wait a moment before sending another question.');
        return;
      }

      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const created = createChatSession();
        targetSessionId = created.id;
        setChatSessions([created]);
        setActiveSessionId(created.id);
      }

      const forceGlobalClinicalMode =
        assistantScope === 'clinical' && isGlobalClinicalIntentQuery(query);
      if (forceGlobalClinicalMode) {
        setClinicalScopeMode('global');
      }
      const resolvedGlobalClinicalMode =
        isGlobalClinicalMode || forceGlobalClinicalMode;

      // Avoid patient-scoped chat carryover contaminating global all-patients summaries.
      const includeConversationHistory = !(
        assistantScope === 'clinical' && resolvedGlobalClinicalMode
      );

      const priorTurns = includeConversationHistory
        ? conversation.slice(-CONTEXT_TURNS_LIMIT).map((entry) => ({
            query: entry.query,
            answer: normalizeMarkdownValue(entry.response.answer),
            timestamp: entry.timestamp,
          }))
        : [];

      setLastSubmitAt(now);

      setIsStreaming(true);
      setStreamingText('');
      setPendingQuery(query);
      setStreamError(null);

      const effectiveQuery =
        assistantScope === 'clinical'
          ? buildSocraticClinicalQuery(
              query,
              {
                patientName,
                emrNumber,
                encounterId,
                chiefComplaint,
                consultationData,
              },
              { globalMode: resolvedGlobalClinicalMode },
            )
          : query;

      // Subscribe to live chunks BEFORE starting the request
      const unsubscribe = onStreamChunk((data) => {
        if (data.error) {
          setStreamError(data.error);
          return;
        }
        const chunk = normalizeMarkdownValue(data.chunk);
        if (!data.done && chunk) {
          setStreamingText((prev) => prev + chunk);
        }
      });
      streamCleanupRef.current = unsubscribe;

      const request: AIQueryRequest = {
        query: effectiveQuery,
        imageAttachments,
        conversationHistory: priorTurns,
        patientId: resolvedGlobalClinicalMode
          ? undefined
          : effectivePatientId || undefined,
        encounterId: encounterId || undefined,
        assistantScope,
        facilityId,
        userId,
        searchType: searchType || 'hybrid',
        maxResults: resolvedGlobalClinicalMode ? 50 : 10,
      };

      const runStreamRequest = async () => {
        return Promise.race([
          queryAIStream(request),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  'AI response timed out. The local Phi-3 model is taking too long. Try a shorter question or retry once Ollama is idle.',
                ),
              );
            }, CLIENT_STREAM_REQUEST_TIMEOUT_MS);
          }),
        ]);
      };

      runStreamRequest()
        .then((response) => {
          unsubscribe();
          streamCleanupRef.current = null;
          setIsStreaming(false);
          setStreamingText('');
          setPendingQuery('');
          const safeResponse = normalizeAIResponsePayload(response);
          const normalizedAnswer = normalizeHospitalVisitSummaryAnswer(
            query,
            safeResponse.answer,
          );
          const normalizedResponse: AIResponse =
            normalizedAnswer === safeResponse.answer
              ? safeResponse
              : { ...safeResponse, answer: normalizedAnswer };
          setChatSessions((prev) => {
            const nowIso = new Date().toISOString();
            const entry: ConversationEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              query,
              response: normalizedResponse,
              timestamp: nowIso,
            };

            const updated = prev.map((session) => {
              if (session.id !== targetSessionId) return session;
              const nextMessages = [...session.messages, entry].slice(
                -MAX_MESSAGES_PER_SESSION,
              );
              return {
                ...session,
                title:
                  session.messages.length === 0
                    ? deriveChatTitle(query)
                    : session.title,
                updatedAt: nowIso,
                messages: nextMessages,
              };
            });

            return sortSessionsByRecent(updated);
          });
        })
        .catch((err) => {
          unsubscribe();
          streamCleanupRef.current = null;
          setIsStreaming(false);
          setStreamingText('');
          setPendingQuery('');
          setStreamError(err?.message || 'Something went wrong');
        });
    },
    [
      canSubmitQueries,
      isStreaming,
      lastSubmitAt,
      activeSessionId,
      createChatSession,
      conversation,
      effectivePatientId,
      assistantScope,
      facilityId,
      userId,
      consultationData,
      isGlobalClinicalMode,
      blockingReadinessIssues,
    ],
  );

  // ── Expand toggle ──
  const toggleExpand = useCallback(() => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandToggle?.(next);
  }, [isExpanded, onExpandToggle]);

  const startNewChat = useCallback(() => {
    if (isStreaming) return;
    const next = createChatSession();
    setChatSessions((prev) =>
      sortSessionsByRecent([next, ...prev]).slice(0, MAX_CHAT_SESSIONS),
    );
    setActiveSessionId(next.id);
    setPendingQuery('');
    setStreamingText('');
    setStreamError(null);
  }, [isStreaming, createChatSession]);

  // ── Clear conversation ──
  const clearConversation = useCallback(() => {
    if (!activeSessionId) return;
    const nowIso = new Date().toISOString();
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages: [], updatedAt: nowIso, title: 'New chat' }
          : session,
      ),
    );
  }, [activeSessionId]);

  const clearAllChats = useCallback(() => {
    if (isStreaming) return;
    const next = createChatSession();
    setChatSessions([next]);
    setActiveSessionId(next.id);
    setPendingQuery('');
    setStreamingText('');
    setStreamError(null);
    void removeSyncMetaValue(storageKey);
  }, [isStreaming, createChatSession, storageKey]);

  // ── Minimised State ──
  if (!isMinimal && isMinimised) {
    return (
      <button
        onClick={() => setIsMinimised(false)}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all ${className}`}
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-semibold">AI Assistant</span>
        {conversation.length > 0 && (
          <span className="bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {conversation.length}
          </span>
        )}
        {isStreaming && <Loader2 className="w-4 h-4 animate-spin" />}
      </button>
    );
  }

  const healthOk =
    aiHealth.data?.configured &&
    aiHealth.data?.llmReachable &&
    aiHealth.data?.supabaseConfigured;
  const healthLabel = healthOk
    ? `Connected • ${aiHealth.data?.provider ?? 'AI'}`
    : aiHealth.isLoading
      ? 'Connecting…'
      : blockingReadinessIssues.length > 0
        ? 'Setup required'
        : advisoryReadinessIssues.length > 0
          ? 'Limited mode'
          : 'Offline';

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-gray-900 transition-all duration-300 ${className}`}
    >
      {!isMinimal && (
        <>
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight truncate">
                  AI Clinical Assistant
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      healthOk
                        ? 'bg-green-400'
                        : aiHealth.isLoading
                          ? 'bg-yellow-400 animate-pulse'
                          : 'bg-red-400'
                    }`}
                  />
                  <span className="text-xs text-white/80 truncate">
                    {healthLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {conversation.length > 0 && (
                <button
                  onClick={clearConversation}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleExpand}
                className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                title={isExpanded ? 'Narrow panel' : 'Widen panel'}
              >
                {isExpanded ? (
                  <Shrink className="w-4 h-4" />
                ) : (
                  <Expand className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsMinimised(true)}
                className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                title="Minimise"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/15 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── Patient Brief ── */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <AIEncounterBrief
              encounter={
                effectivePatientId
                  ? {
                      patientName,
                      emrNumber,
                      chiefComplaint,
                      department,
                      visitDate,
                    }
                  : null
              }
              syncStatus={syncStatus}
            />
            {isClinicalScope && patientId && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="inline-flex w-full sm:w-auto rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setClinicalScopeMode('patient')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold transition-colors ${
                      !isGlobalClinicalMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    This Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setClinicalScopeMode('global')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1 ${
                      isGlobalClinicalMode
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    All Patients
                  </button>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 rounded-md">
                  {isGlobalClinicalMode
                    ? 'Global mode active: answers can reference records across all patients and modules.'
                    : 'Patient mode active: answers are narrowed to the selected patient chart.'}
                </p>
              </div>
            )}
            {(blockingReadinessIssues.length > 0 ||
              advisoryReadinessIssues.length > 0) && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {blockingReadinessIssues.length > 0
                    ? 'AI setup required'
                    : 'AI search degraded'}
                </p>
                <div className="mt-2 space-y-1.5 text-xs leading-5">
                  {blockingReadinessIssues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                  {advisoryReadinessIssues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-900'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <tab.Icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Chat Tab */}
        {(isMinimal || activeTab === 'chat') && (
          <div className="flex h-full min-h-0">
            <aside
              className={`border-r border-gray-200 dark:border-gray-700 ${isMinimal ? 'w-56' : 'w-64'} bg-gray-50/70 dark:bg-gray-800/40 flex flex-col min-h-0`}
            >
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  Chats
                </div>
                <div className="flex items-center gap-1">
                  {chatSessions.length > 1 && (
                    <button
                      onClick={clearAllChats}
                      disabled={isStreaming}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      title="Clear all chats"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  )}
                  <button
                    onClick={startNewChat}
                    disabled={isStreaming}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    title="Start a new chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chatSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() =>
                      !isStreaming && setActiveSessionId(session.id)
                    }
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors border ${
                      session.id === activeSessionId
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-900/50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                    } ${isStreaming ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <p className="text-xs font-semibold truncate">
                      {session.title || 'New chat'}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {formatLastUpdated(session.updatedAt)}
                      </span>
                      <span>{session.messages.length}</span>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex-1 min-w-0 flex flex-col h-full">
              {/* Conversation Area */}
              <div className="flex-1 overflow-y-auto">
                {conversation.length === 0 && !isStreaming ? (
                  isMinimal ? (
                    <div className="flex items-center justify-center h-full px-6">
                      <p className="text-xs text-gray-400">
                        {effectivePatientId
                          ? 'Ask a question about this patient.'
                          : canQueryWithoutPatient
                            ? assistantScope === 'pharmacy'
                              ? 'Ask about pharmacy records, inventory, or transactions. Select a patient to narrow results.'
                              : 'Ask across patient records, encounters, labs, radiology, billing, and procedures. Select a patient to narrow results.'
                            : 'Select a patient to start.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full p-5">
                      <div className="flex flex-col items-center justify-center mb-6 mt-2 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg mb-4">
                          <Bot className="w-7 h-7 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          Hello, Doctor!
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-[280px]">
                          Select a records workflow to run a structured chart
                          review, or type your own question below.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                        {browseWorkflows.map((item) => (
                          <button
                            key={item.label}
                            onClick={() =>
                              handleSubmit(
                                adaptClinicalWorkflowQueryForScope(
                                  item.query,
                                  isGlobalClinicalMode,
                                ),
                              )
                            }
                            disabled={!canRunAIQueries || isStreaming}
                            className={`group flex items-start gap-3 p-3 rounded-xl border border-transparent hover:border-gray-200 dark:hover:border-gray-700 text-left transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${item.bg}`}
                          >
                            <div
                              className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center bg-white/60 dark:bg-black/20 shadow-sm flex-shrink-0 ${item.color}`}
                            >
                              <item.icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {item.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {!canSubmitQueries && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium text-center bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
                          Please select a patient first to start using the
                          assistant.
                        </p>
                      )}

                      {canQueryWithoutPatient && !effectivePatientId && (
                        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium text-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                          {assistantScope === 'pharmacy'
                            ? 'Global pharmacy mode is active. Select a patient only when you want patient-specific narrowing.'
                            : 'Global clinical mode is active. Select a patient only when you want patient-specific narrowing.'}
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  <div className="p-4 space-y-6">
                    {conversation.map((entry) => (
                      <div key={entry.id} className="space-y-4">
                        <div className="flex justify-end">
                          <div className="max-w-[85%] relative">
                            <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shadow">
                              {entry.query}
                            </div>
                            {!isMinimal && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right pr-1">
                                {new Date(entry.timestamp).toLocaleTimeString(
                                  'en-US',
                                  { hour: '2-digit', minute: '2-digit' },
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <AIResponseCard
                              answer={entry.response.answer}
                              sources={entry.response.sources}
                              confidence={entry.response.confidence}
                              model={entry.response.model}
                              tokensUsed={
                                typeof entry.response.tokensUsed === 'number'
                                  ? entry.response.tokensUsed
                                  : undefined
                              }
                              searchType={entry.response.searchType}
                              resultCount={entry.response.resultCount}
                              variant={isMinimal ? 'minimal' : 'full'}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {isStreaming && (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <div className="max-w-[85%] relative">
                            <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm shadow">
                              {pendingQuery}
                            </div>
                          </div>
                        </div>

                        {streamingText ? (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-800 dark:text-gray-200 relative">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    table: ({ node, ...props }) => (
                                      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <table
                                          className="min-w-full divide-y divide-gray-200 dark:border-gray-700 !m-0"
                                          {...props}
                                        />
                                      </div>
                                    ),
                                    th: ({ node, ...props }) => (
                                      <th
                                        className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        {...props}
                                      />
                                    ),
                                    td: ({ node, ...props }) => (
                                      <td
                                        className="px-4 py-2.5 whitespace-nowrap text-sm border-t border-gray-100 dark:border-gray-800"
                                        {...props}
                                      />
                                    ),
                                    h2: ({ node, ...props }) => (
                                      <h2
                                        className="text-base font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3 border-b pb-1 dark:border-gray-800"
                                        {...props}
                                      />
                                    ),
                                    h3: ({ node, ...props }) => (
                                      <h3
                                        className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2"
                                        {...props}
                                      />
                                    ),
                                    ul: ({ node, ...props }) => (
                                      <ul
                                        className="list-disc pl-5 mt-2 mb-4 space-y-1"
                                        {...props}
                                      />
                                    ),
                                    li: ({ node, ...props }) => (
                                      <li className="pl-1" {...props} />
                                    ),
                                    p: ({ node, ...props }) => (
                                      <p
                                        className="mb-3 leading-relaxed"
                                        {...props}
                                      />
                                    ),
                                  }}
                                >
                                  {streamingText}
                                </ReactMarkdown>
                                <span className="inline-block w-2 h-4 ml-1 align-baseline bg-blue-500 animate-pulse rounded-sm" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2">
                            <TypingIndicator />
                          </div>
                        )}
                      </div>
                    )}

                    {streamError && !isStreaming && (
                      <div className="flex items-start gap-3 px-1 mt-4">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1 p-4 rounded-2xl rounded-tl-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
                            Something went wrong
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {streamError}
                          </p>
                          <button
                            onClick={() =>
                              conversation.length > 0 &&
                              handleSubmit(
                                conversation[conversation.length - 1].query,
                              )
                            }
                            className="mt-3 text-sm font-medium text-red-700 dark:text-red-300 hover:underline flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Retry last
                            query
                          </button>
                        </div>
                      </div>
                    )}

                    <div ref={conversationEndRef} />
                  </div>
                )}
              </div>

              <div
                className={`border-t border-gray-200 dark:border-gray-700 p-4 ${isMinimal ? 'bg-white' : 'bg-gray-50/80 dark:bg-gray-800/50'}`}
              >
                <AIQueryInput
                  onSubmit={handleSubmit}
                  isLoading={isStreaming}
                  disabled={!canRunAIQueries}
                  placeholder={
                    effectivePatientId
                      ? 'Ask a clinical question...'
                      : canQueryWithoutPatient
                        ? assistantScope === 'pharmacy'
                          ? 'Ask about inventory, dispensing, or pharmacy transactions...'
                          : 'Ask a global clinical question across encounters, labs, radiology, procedures, or billing...'
                        : 'Select a patient first'
                  }
                  showQuickActions={!isMinimal}
                  showSearchType={!isMinimal}
                />
              </div>
            </div>
          </div>
        )}

        {!isMinimal && (
          <>
            {/* Trends Tab */}
            {activeTab === 'trends' && (
              <div className="p-4">
                <AITrendInsights
                  trends={trends || []}
                  isLoading={trendsLoading}
                />
              </div>
            )}

            {/* Completeness Tab */}
            {activeTab === 'completeness' && (
              <div className="p-4">
                <AICompletenessScore score={completenessScore} />
              </div>
            )}

            {/* Coding Tab */}
            {activeTab === 'coding' && (
              <div className="p-4">
                <AICodingSuggestions
                  suggestions={[]}
                  existingCodes={existingCodes}
                  onAddCode={onAddCode}
                />
                <p className="text-xs text-gray-400 text-center mt-4">
                  Enter consultation details in the Chat tab and ask for coding
                  suggestions.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer Disclaimer ── */}
      {!isMinimal && (
        <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <AIDisclaimer compact />
        </div>
      )}
    </div>
  );
}
