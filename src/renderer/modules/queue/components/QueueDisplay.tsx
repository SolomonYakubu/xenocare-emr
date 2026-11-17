import React from 'react';
import { Monitor, Users, Clock } from 'lucide-react';
import {
  DepartmentQueue,
  getDepartmentColor,
  formatQueueNumber,
} from '../dtos/queue.dto';
import { useDepartmentQueues, useCurrentNumber } from '../hooks/useQueue';
import { SkeletonList } from '../../../components/ui/SkeletonLoader';

/**
 * Large display board for waiting area screens
 */
export function QueueDisplay() {
  const { data: departments, isLoading } = useDepartmentQueues();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <SkeletonList count={5} />
      </div>
    );
  }

  // Filter to show only departments with activity
  const activeDepartments = departments?.filter(
    (d) => d.waiting > 0 || d.current_number,
  );

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Queue Display</h1>
        <p className="text-gray-400 text-lg">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Department Cards Grid */}
      {activeDepartments && activeDepartments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeDepartments.map((dept) => (
            <DepartmentCard key={dept.department} department={dept} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <Monitor className="h-24 w-24 text-gray-600 mb-4" />
          <p className="text-2xl text-gray-400">No active queues</p>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center text-gray-400">
            <Clock className="h-5 w-5 mr-2" />
            <span>Auto-refreshing every 10 seconds</span>
          </div>
          <div className="text-gray-400 text-sm">
            XenoCare System
          </div>
        </div>
      </div>
    </div>
  );
}

interface DepartmentCardProps {
  department: DepartmentQueue;
}

function DepartmentCard({ department }: DepartmentCardProps) {
  const colorClasses = getDepartmentColor(department.department);
  const colorMap: Record<string, { bg: string; text: string; border: string }> =
    {
      blue: {
        bg: 'bg-blue-600',
        text: 'text-blue-100',
        border: 'border-blue-500',
      },
      purple: {
        bg: 'bg-purple-600',
        text: 'text-purple-100',
        border: 'border-purple-500',
      },
      green: {
        bg: 'bg-green-600',
        text: 'text-green-100',
        border: 'border-green-500',
      },
      indigo: {
        bg: 'bg-indigo-600',
        text: 'text-indigo-100',
        border: 'border-indigo-500',
      },
      cyan: {
        bg: 'bg-cyan-600',
        text: 'text-cyan-100',
        border: 'border-cyan-500',
      },
      amber: {
        bg: 'bg-amber-600',
        text: 'text-amber-100',
        border: 'border-amber-500',
      },
      emerald: {
        bg: 'bg-emerald-600',
        text: 'text-emerald-100',
        border: 'border-emerald-500',
      },
      gray: {
        bg: 'bg-gray-600',
        text: 'text-gray-100',
        border: 'border-gray-500',
      },
    };

  const colors = colorMap[colorClasses] || colorMap.gray;

  return (
    <div className={`${colors.bg} rounded-xl p-6 shadow-lg`}>
      {/* Department Name */}
      <h2 className="text-xl font-semibold text-white mb-4">
        {department.department}
      </h2>

      {/* Current Number */}
      <div className="bg-white/20 rounded-lg p-4 mb-4">
        <p className={`text-sm ${colors.text} mb-1`}>Now Serving</p>
        <p className="text-5xl font-bold text-white text-center">
          {department.current_number
            ? formatQueueNumber(
                department.department,
                department.current_number,
              )
            : '---'}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-white/80">
        <div className="flex items-center">
          <Users className="h-5 w-5 mr-2" />
          <span>{department.waiting} waiting</span>
        </div>
        {department.in_progress > 0 && (
          <span className="text-sm">{department.in_progress} in progress</span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact department display for sidebar or widget
 */
interface QueueWidgetProps {
  onDepartmentClick?: (department: string) => void;
}

export function QueueWidget({ onDepartmentClick }: QueueWidgetProps) {
  const { data: departments, isLoading } = useDepartmentQueues();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {departments?.map((dept) => (
        <button
          key={dept.department}
          onClick={() => onDepartmentClick?.(dept.department)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-2 rounded-full bg-${getDepartmentColor(dept.department)}-500`}
            />
            <span className="font-medium text-gray-700">{dept.department}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {dept.current_number && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                #{dept.current_number}
              </span>
            )}
            <span className="text-gray-500">{dept.waiting} waiting</span>
          </div>
        </button>
      ))}
    </div>
  );
}
