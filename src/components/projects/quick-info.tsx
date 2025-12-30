'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, User, Info, ExternalLink, Mail, Phone, FileText, Link as LinkIcon, CircleDot } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InlineEditField } from './inline-edit-field';
import { InlineDateRangePicker } from './inline-date-range-picker';
import { ScheduleStatusSelect } from './schedule-status-select';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { StatusBadge } from './status-badge';
import { inlineEditProjectField, updateProjectDates, updateProjectScheduleStatus } from '@/app/(dashboard)/projects/actions';
import { toast } from 'sonner';
import type { BookingStatus } from '@/types/calendar';

interface QuickInfoProps {
  project: {
    id: string;
    goal_completion_date: string | null;
    start_date: string | null;
    end_date: string | null;
    sales_amount: number | null;
    sales_order_number: string | null;
    sales_order_url: string | null;
    schedule_status?: BookingStatus | null;
    current_status?: {
      id: string;
      name: string;
    } | null;
    salesperson?: {
      id: string;
      full_name: string | null;
      email: string;
    } | null;
    poc_name: string | null;
    poc_email: string | null;
    poc_phone: string | null;
    scope_link: string | null;
    salesperson_id: string | null;
  };
  statuses?: Array<{
    id: string;
    name: string;
  }>;
  salespeople: Array<{
    id: string;
    full_name: string | null;
    email: string;
  }>;
  isOverdue?: boolean;
  canEdit?: boolean;
  canEditSchedule?: boolean;
  onStatusChange?: (statusId: string) => void;
}

export function QuickInfo({
  project,
  statuses = [],
  salespeople,
  isOverdue = false,
  canEdit = false,
  canEditSchedule = false,
  onStatusChange,
}: QuickInfoProps) {
  const hasProjectDates = Boolean(project.start_date && project.end_date);

  const handleFieldSave = async (field: string, value: string) => {
    const result = await inlineEditProjectField({
      projectId: project.id,
      field,
      value: value || null,
    });

    if (!result.success) {
      toast.error(result.error || 'Failed to update');
      throw new Error(result.error);
    }
    toast.success('Updated successfully');
  };

  const handleDateRangeSave = async (startDate: string | null, endDate: string | null) => {
    if (!startDate || !endDate) {
      toast.error('Both start and end dates are required');
      throw new Error('Both dates required');
    }

    const result = await updateProjectDates({
      projectId: project.id,
      startDate,
      endDate,
    });

    if (!result.success) {
      toast.error(result.error || 'Failed to update dates');
      throw new Error(result.error);
    }
    toast.success('Project dates updated');
  };

  const handleScheduleStatusChange = async (newStatus: BookingStatus) => {
    const result = await updateProjectScheduleStatus({
      projectId: project.id,
      scheduleStatus: newStatus,
    });

    if (!result.success) {
      toast.error(result.error || 'Failed to update schedule status');
      return;
    }
    toast.success('Schedule status updated');
  };

  const formatDateForDisplay = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), 'MMM d, yyyy');
  };

  const formatDateForInput = (date: string | null) => {
    if (!date) return '';
    return format(new Date(date), 'yyyy-MM-dd');
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-sm font-medium">Quick Info</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {/* Project Status */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Status</span>
            {canEdit && statuses.length > 0 ? (
              <InlineEditField
                value={project.current_status?.id || ''}
                displayValue={
                  project.current_status ? (
                    <StatusBadge status={project.current_status} />
                  ) : undefined
                }
                type="select"
                options={statuses.map(s => ({
                  value: s.id,
                  label: s.name,
                }))}
                onSave={async (v) => {
                  await handleFieldSave('status_id', v);
                  if (onStatusChange) {
                    onStatusChange(v);
                  }
                }}
              />
            ) : project.current_status ? (
              <StatusBadge status={project.current_status} />
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>
          {/* Schedule Status */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Schedule</span>
            {canEditSchedule && hasProjectDates ? (
              <ScheduleStatusSelect
                value={project.schedule_status ?? null}
                onChange={handleScheduleStatusChange}
                hasProjectDates={hasProjectDates}
              />
            ) : hasProjectDates ? (
              <ScheduleStatusBadge status={project.schedule_status ?? null} />
            ) : (
              <span className="text-xs text-muted-foreground italic">Set dates first</span>
            )}
          </div>

          {/* Goal Date */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Goal Date</span>
            {canEdit ? (
              <InlineEditField
                value={formatDateForInput(project.goal_completion_date)}
                displayValue={
                  project.goal_completion_date ? (
                    <span className={cn('font-medium text-sm', isOverdue && 'text-destructive')}>
                      {formatDateForDisplay(project.goal_completion_date)}
                    </span>
                  ) : undefined
                }
                type="date"
                onSave={(v) => handleFieldSave('goal_date', v)}
                className={cn(isOverdue && 'text-destructive')}
              />
            ) : project.goal_completion_date ? (
              <span className={cn('font-medium text-sm', isOverdue && 'text-destructive')}>
                {formatDateForDisplay(project.goal_completion_date)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Project Dates */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Project Dates</span>
            <div className="text-sm">
              {canEdit ? (
                <InlineDateRangePicker
                  startDate={project.start_date}
                  endDate={project.end_date}
                  onSave={handleDateRangeSave}
                />
              ) : project.start_date && project.end_date ? (
                <span className="font-medium">
                  {format(new Date(project.start_date), 'MMM d')} — {format(new Date(project.end_date), 'MMM d, yyyy')}
                </span>
              ) : project.start_date ? (
                <span className="font-medium">
                  Starts {format(new Date(project.start_date), 'MMM d, yyyy')}
                </span>
              ) : project.end_date ? (
                <span className="font-medium">
                  Ends {format(new Date(project.end_date), 'MMM d, yyyy')}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Not set</span>
              )}
            </div>
          </div>

          {/* Sales Amount */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Sales Amount</span>
            {canEdit ? (
              <InlineEditField
                value={project.sales_amount?.toString() || ''}
                displayValue={
                  project.sales_amount ? (
                    <span className="font-semibold tabular-nums">
                      ${project.sales_amount.toLocaleString()}
                    </span>
                  ) : undefined
                }
                type="currency"
                onSave={(v) => handleFieldSave('sales_amount', v)}
                inputClassName="w-[100px]"
              />
            ) : project.sales_amount ? (
              <span className="font-semibold tabular-nums">
                ${project.sales_amount.toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Salesperson */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Salesperson</span>
            {canEdit ? (
              <InlineEditField
                value={project.salesperson_id || ''}
                displayValue={
                  project.salesperson ? (
                    <span className="font-medium text-sm">
                      {project.salesperson.full_name || project.salesperson.email}
                    </span>
                  ) : undefined
                }
                type="select"
                options={salespeople.map(sp => ({
                  value: sp.id,
                  label: sp.full_name || sp.email,
                }))}
                onSave={(v) => handleFieldSave('salesperson_id', v)}
              />
            ) : project.salesperson ? (
              <span className="font-medium text-sm">
                {project.salesperson.full_name || project.salesperson.email}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Sales Order # */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Sales Order #</span>
            {canEdit ? (
              <InlineEditField
                value={project.sales_order_number || ''}
                displayValue={
                  project.sales_order_number ? (
                    <span className="font-medium font-mono text-sm">{project.sales_order_number}</span>
                  ) : undefined
                }
                type="text"
                onSave={(v) => handleFieldSave('sales_order_number', v)}
                inputClassName="w-[80px] font-mono uppercase"
              />
            ) : project.sales_order_number ? (
              <span className="font-medium font-mono text-sm">{project.sales_order_number}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Sales Order URL */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm text-muted-foreground">Odoo Link</span>
            {canEdit ? (
              <InlineEditField
                value={project.sales_order_url || ''}
                displayValue={
                  project.sales_order_url ? (
                    <a
                      href={project.sales_order_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </a>
                  ) : undefined
                }
                type="text"
                onSave={(v) => handleFieldSave('sales_order_url', v)}
                placeholder="URL"
                inputClassName="w-[160px]"
              />
            ) : project.sales_order_url ? (
              <a
                href={project.sales_order_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-sm"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </a>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* POC Info */}
          {project.poc_name && (
            <div className="px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contact</span>
                <span className="font-medium text-sm">{project.poc_name}</span>
              </div>
              <div className="flex justify-end gap-3 mt-1">
                {project.poc_email && (
                  <a
                    href={`mailto:${project.poc_email}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {project.poc_email}
                  </a>
                )}
                {project.poc_phone && (
                  <a
                    href={`tel:${project.poc_phone}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {project.poc_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Scope Link */}
          {project.scope_link && (
            <div className="px-3 py-2">
              <a
                href={project.scope_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center justify-end gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View Scope Document
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
