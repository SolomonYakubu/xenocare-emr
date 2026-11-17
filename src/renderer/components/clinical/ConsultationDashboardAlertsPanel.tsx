import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/FormElements';
import {
  ConsultationClinicalAlerts,
  type ConsultationClinicalAlertsProps,
} from './ConsultationClinicalAlerts';
import { useNotifications } from '../../hooks/useNotifications';

const ALERTS_PER_PAGE = 2;

export interface ConsultationDashboardAlertsPanelProps extends Pick<
  ConsultationClinicalAlertsProps,
  'patientIdForLookup' | 'patientDisplayName' | 'encounter' | 'isNightMode'
> {
  className?: string;
  /** Show system notification inbox (same as specialty clinic dashboard). Default true. */
  showInbox?: boolean;
  /** Optional content below inbox (e.g. specialty referral teaser on clinic dashboard). */
  children?: React.ReactNode;
}

/**
 * Mirrors the specialty clinic dashboard right column: active-patient clinical alerts + optional inbox.
 * Use on OPD, dental, physio, ophthalmology, and other consultation-style dashboards.
 */
export function ConsultationDashboardAlertsPanel({
  patientIdForLookup,
  patientDisplayName,
  encounter,
  isNightMode = false,
  className = '',
  showInbox = true,
  children,
}: ConsultationDashboardAlertsPanelProps) {
  const { notifications, unreadCount } = useNotifications({ limit: 50 });
  const [alertPage, setAlertPage] = useState(1);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(notifications.length / ALERTS_PER_PAGE)),
    [notifications.length],
  );

  const slice = useMemo(() => {
    const start = (alertPage - 1) * ALERTS_PER_PAGE;
    return notifications.slice(start, start + ALERTS_PER_PAGE);
  }, [notifications, alertPage]);

  const shell = isNightMode
    ? 'border-slate-700 bg-slate-900/90'
    : 'border-slate-100/80 bg-[#f4f5f7]';

  const inboxSummary = useMemo(() => {
    if (notifications.length === 0) return 'No items';
    if (unreadCount > 0)
      return `${unreadCount} unread · ${notifications.length} total`;
    return `${notifications.length} update${notifications.length === 1 ? '' : 's'}`;
  }, [notifications.length, unreadCount]);

  return (
    <div
      className={`rounded-xl border p-4 shadow-none sm:rounded-2xl sm:p-4 ${shell} ${className}`}
    >
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Active patient
        </p>
        <ConsultationClinicalAlerts
          patientIdForLookup={patientIdForLookup}
          patientDisplayName={patientDisplayName}
          encounter={encounter}
          isNightMode={isNightMode}
        />
      </div>

      {showInbox && (
        <details className="group/inbox border-t border-slate-200/80 pt-3 dark:border-slate-700">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Inbox &amp; updates
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="max-w-[10rem] truncate text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {inboxSummary}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/inbox:rotate-180" />
            </span>
          </summary>

          <div className="mt-3 max-h-[min(42vh,280px)] space-y-2 overflow-y-auto pr-0.5">
            {notifications.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No notifications yet.
              </p>
            )}
            {slice.map((notification) => {
              const isUrgent =
                notification.priority === 'urgent' ||
                notification.priority === 'critical' ||
                notification.priority === 'high';
              return (
                <div
                  key={notification.id}
                  className="relative overflow-hidden rounded-lg border border-slate-100 bg-white text-left shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div
                    className={`absolute top-0 bottom-0 left-0 w-0.5 ${isUrgent ? 'bg-[#c53030]' : 'bg-[#E9783F]'}`}
                  />
                  <div className="px-3 py-2.5 pl-3.5">
                    <div
                      className={`mb-1 flex items-start justify-between gap-2 text-[9px] font-bold uppercase tracking-wider ${
                        isUrgent ? 'text-[#c53030]' : 'text-[#11151C]'
                      }`}
                    >
                      <span className="line-clamp-1">
                        {notification.type.replace(/_/g, ' ')}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-400">
                        {formatDistanceToNow(
                          new Date(notification.created_at || new Date()),
                          {
                            addSuffix: true,
                          },
                        )}
                      </span>
                    </div>
                    <h4 className="mb-0.5 line-clamp-2 text-xs font-bold leading-snug text-slate-900 dark:text-white">
                      {notification.title}
                    </h4>
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {notification.message}
                    </p>
                    {notification.action_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full rounded-lg border-slate-200 py-1.5 text-[10px] font-bold text-slate-700"
                        onClick={() => {
                          window.location.href = notification.action_url!;
                        }}
                      >
                        {notification.action_label || 'View'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {notifications.length > ALERTS_PER_PAGE && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                onClick={() => setAlertPage((p) => Math.max(1, p - 1))}
                disabled={alertPage === 1}
              >
                ← Newer
              </Button>
              <span className="text-[11px] font-bold text-slate-400">
                {alertPage} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                onClick={() => setAlertPage((p) => Math.min(pageCount, p + 1))}
                disabled={alertPage >= pageCount}
              >
                Older →
              </Button>
            </div>
          )}
        </details>
      )}

      {children}
    </div>
  );
}
