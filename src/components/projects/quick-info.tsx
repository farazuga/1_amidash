'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, User, Info, ExternalLink, Mail, Phone, FileText, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InlineEditField } from './inline-edit-field';
import { InlineDateRangePicker } from './inline-date-range-picker';
import { ProjectScheduleStatus, ProjectScheduleStatusDisplay } from './project-schedule-status';
import { inlineEditProjectField, updateProjectDates } from '@/app/(dashboard)/projects/actions';
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
  salespeople: Array<{
    id: string;
    full_name: string | null;
    email: string;
  }>;
  isOverdue?: boolean;
  canEdit?: boolean;
  canEditSchedule?: boolean;
}

export function QuickInfo({
  project,
  salespeople,
  isOverdue = false,
  canEdit = false,
  canEditSchedule = false,
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

  const formatDateForDisplay = (date: string | null) => {
    if (!date) return null;
    return format(new Date(date), 'MMM d, yyyy');
  };

  const formatDateForInput = (date: string | null) => {
    if (!date) return '';
    return format(new Date(date), 'yyyy-MM-dd');
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-primary/5 to-background">
      <CardHeader className="bg-primary/10 pb-4 border-b border-primary/10">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Quick Info
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-primary/10">
          {/* Goal Date */}
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center',
                  isOverdue ? 'bg-destructive/10' : 'bg-primary/10'
                )}
              >
                <Calendar
                  className={cn(
                    'h-4 w-4',
                    isOverdue ? 'text-destructive' : 'text-primary'
                  )}
                />
              </div>
              <span className="text-sm text-muted-foreground">Goal Date</span>
            </div>
            {canEdit ? (
              <InlineEditField
                value={formatDateForInput(project.goal_completion_date)}
                displayValue={
                  project.goal_completion_date ? (
                    <span className={cn('font-medium', isOverdue && 'text-destructive')}>
                      {formatDateForDisplay(project.goal_completion_date)}
                    </span>
                  ) : undefined
                }
                type="date"
                onSave={(v) => handleFieldSave('goal_date', v)}
                className={cn(isOverdue && 'text-destructive')}
              />
            ) : project.goal_completion_date ? (
              <span className={cn('font-medium', isOverdue && 'text-destructive')}>
                {formatDateForDisplay(project.goal_completion_date)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Schedule Status */}
          <div className="p-4 hover:bg-primary/5 transition-colors">
            {canEditSchedule ? (
              <ProjectScheduleStatus
                projectId={project.id}
                currentStatus={project.schedule_status ?? null}
                hasProjectDates={hasProjectDates}
              />
            ) : (
              <ProjectScheduleStatusDisplay
                status={project.schedule_status ?? null}
                hasProjectDates={hasProjectDates}
              />
            )}
          </div>

          {/* Project Dates */}
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Project Dates</span>
            </div>
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
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Sales Amount</span>
            </div>
            {canEdit ? (
              <InlineEditField
                value={project.sales_amount?.toString() || ''}
                displayValue={
                  project.sales_amount ? (
                    <span className="text-lg font-semibold tabular-nums">
                      ${project.sales_amount.toLocaleString()}
                    </span>
                  ) : undefined
                }
                type="currency"
                onSave={(v) => handleFieldSave('sales_amount', v)}
                inputClassName="w-[120px]"
              />
            ) : project.sales_amount ? (
              <span className="text-lg font-semibold tabular-nums">
                ${project.sales_amount.toLocaleString()}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Salesperson */}
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Salesperson</span>
            </div>
            {canEdit ? (
              <InlineEditField
                value={project.salesperson_id || ''}
                displayValue={
                  project.salesperson ? (
                    <span className="font-medium">
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
              <span className="font-medium">
                {project.salesperson.full_name || project.salesperson.email}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Sales Order Number */}
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Sales Order #</span>
            </div>
            {canEdit ? (
              <InlineEditField
                value={project.sales_order_number || ''}
                displayValue={
                  project.sales_order_number ? (
                    <span className="font-medium font-mono">{project.sales_order_number}</span>
                  ) : undefined
                }
                type="text"
                onSave={(v) => handleFieldSave('sales_order_number', v)}
                inputClassName="w-[80px] font-mono uppercase"
              />
            ) : project.sales_order_number ? (
              <span className="font-medium font-mono">{project.sales_order_number}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* Sales Order URL */}
          <div className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Sales Order URL</span>
            </div>
            {canEdit ? (
              <InlineEditField
                value={project.sales_order_url || ''}
                displayValue={
                  project.sales_order_url ? (
                    <a
                      href={project.sales_order_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View in Odoo
                    </a>
                  ) : undefined
                }
                type="text"
                onSave={(v) => handleFieldSave('sales_order_url', v)}
                placeholder="Odoo URL"
                inputClassName="w-[200px]"
              />
            ) : project.sales_order_url ? (
              <a
                href={project.sales_order_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View in Odoo
              </a>
            ) : (
              <span className="text-sm text-muted-foreground italic">Not set</span>
            )}
          </div>

          {/* POC Info */}
          {project.poc_name && (
            <div className="p-4 hover:bg-primary/5 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Point of Contact</span>
              </div>
              <div className="ml-11 space-y-1">
                <p className="font-medium">{project.poc_name}</p>
                {project.poc_email && (
                  <a
                    href={`mailto:${project.poc_email}`}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {project.poc_email}
                  </a>
                )}
                {project.poc_phone && (
                  <a
                    href={`tel:${project.poc_phone}`}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {project.poc_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Scope Link */}
          {project.scope_link && (
            <div className="p-4 bg-primary/5">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start hover:bg-primary/10 hover:border-primary/30 border-primary/20"
                asChild
              >
                <a
                  href={project.scope_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Scope Document
                </a>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
