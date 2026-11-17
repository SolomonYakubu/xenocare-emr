/**
 * XenoCare
 * Export Audit Logger
 *
 * Every export action is logged to the clinical_audit_log via the
 * enhanced audit service so administration can track who exported what.
 */

import { supabase } from '../../../api/supabaseClient';
import type { ExportAuditEntry } from '../types/report.types';

/**
 * Log an export action to the audit trail.
 * Fire-and-forget — failures are silently logged; they must not block the export.
 */
export async function logExportAudit(entry: ExportAuditEntry): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      category: 'data_export',
      action: 'export',
      severity: 'notice',
      user_id: entry.exported_by,
      user_name: entry.exported_by_name,
      resource_type: `${entry.module}_report`,
      description: `Exported ${entry.record_count} ${entry.module} records as ${entry.format}`,
      metadata: {
        module: entry.module,
        format: entry.format,
        record_count: entry.record_count,
        filters: entry.filters,
        exported_at: entry.exported_at,
      },
    });
  } catch (err) {
    // Audit failures must never break the export workflow
    console.error('[ExportAudit] Failed to write audit entry:', err);
  }
}
