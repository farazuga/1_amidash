'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CONTRACT_TYPES } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Project, Tag, Profile, ProjectType } from '@/types';
import type { ACAccount, ACContact } from '@/types/activecampaign';
import { createProject } from '@/app/(dashboard)/projects/actions';
import { ClientNameAutocomplete } from './client-name-autocomplete';
import { ContactSelector } from './contact-selector';
import { SecondaryContactSelector } from './secondary-contact-selector';
import { useActiveCampaignContacts } from '@/hooks/use-activecampaign';
import { ProjectDatePicker } from '@/components/calendar/project-date-picker';
import {
  calculateGoalDate,
  cleanSalesAmount,
  formatPhoneNumber,
  validateProjectForm,
  validateSalesOrderNumber,
} from '@/lib/projects/utils';

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // Handle ISO date strings - extract just the date part (YYYY-MM-DD)
  return dateStr.split('T')[0];
}

interface ProjectFormProps {
  project?: Project;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statuses: any[];
  tags: Tag[];
  projectTags?: string[];
  salespeople: Profile[];
  projectTypes: ProjectType[];
  projectTypeStatuses: { project_type_id: string; status_id: string }[];
  currentUserId?: string;
}

export function ProjectForm({
  project,
  statuses,
  tags,
  projectTags = [],
  salespeople,
  projectTypes,
  projectTypeStatuses,
  currentUserId,
}: ProjectFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(projectTags);
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>(
    project?.salesperson_id || ''
  );
  const [selectedProjectType, setSelectedProjectType] = useState<string>(
    project?.project_type_id || ''
  );
  const [salesOrderNumber, setSalesOrderNumber] = useState<string>(
    project?.sales_order_number || (project ? '' : 'S1')
  );
  const [salesOrderError, setSalesOrderError] = useState<string | null>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<boolean>(
    project?.email_notifications_enabled ?? true
  );
  const [pocPhone, setPocPhone] = useState<string>(project?.poc_phone || '');
  const [salesAmount, setSalesAmount] = useState<string>(
    project?.sales_amount?.toString() || ''
  );
  const [numberOfVidpods, setNumberOfVidpods] = useState<string>(
    project?.number_of_vidpods?.toString() || ''
  );
  const [vidpodOnly, setVidpodOnly] = useState<boolean>(
    project?.vidpod_only ?? false
  );
  const [createdDate, setCreatedDate] = useState<string>(
    formatDateForInput(project?.created_date) || new Date().toISOString().split('T')[0]
  );
  const [goalCompletionDate, setGoalCompletionDate] = useState<string>(
    formatDateForInput(project?.goal_completion_date) || ''
  );
  const [startDate, setStartDate] = useState<string>(
    formatDateForInput(project?.start_date) || ''
  );
  const [endDate, setEndDate] = useState<string>(
    formatDateForInput(project?.end_date) || ''
  );
  const [secondaryPocEmail, setSecondaryPocEmail] = useState<string>(
    project?.secondary_poc_email || ''
  );

  // Active Campaign integration state
  const [clientName, setClientName] = useState<string>(project?.client_name || '');
  const [selectedAccount, setSelectedAccount] = useState<ACAccount | null>(null);
  const [selectedPrimaryContact, setSelectedPrimaryContact] = useState<ACContact | null>(null);
  const [selectedSecondaryContact, setSelectedSecondaryContact] = useState<ACContact | null>(null);
  const [pocName, setPocName] = useState<string>(project?.poc_name || '');
  const [pocEmail, setPocEmail] = useState<string>(project?.poc_email || '');

  // Get contacts for selected AC account
  const { contacts: acContacts, isLoading: acContactsLoading } = useActiveCampaignContacts(
    selectedAccount?.id || null
  );

  const isEditing = !!project;

  // State for project type change warning dialog (when editing)
  const [showTypeChangeWarning, setShowTypeChangeWarning] = useState(false);
  const [pendingProjectType, setPendingProjectType] = useState<string | null>(null);
  const [needsStatusSelection, setNeedsStatusSelection] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>('');

  // Get statuses available for the selected project type
  const getAvailableStatuses = (projectTypeId: string) => {
    const statusIds = projectTypeStatuses
      .filter(pts => pts.project_type_id === projectTypeId)
      .map(pts => pts.status_id);
    return statuses.filter(s => statusIds.includes(s.id) && s.is_active);
  };

  // Handle project type change (when editing)
  const handleProjectTypeChange = (newTypeId: string) => {
    if (!isEditing) {
      // For new projects, just set the type and auto-calculate goal date
      setSelectedProjectType(newTypeId);
      const typeName = projectTypes.find(t => t.id === newTypeId)?.name || '';
      const calculatedGoal = calculateGoalDate(typeName);
      setGoalCompletionDate(calculatedGoal);
      return;
    }

    // For existing projects, check if current status is valid for new type
    const newTypeStatuses = getAvailableStatuses(newTypeId);
    const currentStatusValid = newTypeStatuses.some(s => s.id === project?.current_status_id);

    if (!currentStatusValid) {
      // Show warning dialog - status is not valid for new type
      setPendingProjectType(newTypeId);
      setNeedsStatusSelection(true);
      setSelectedNewStatus(newTypeStatuses[0]?.id || '');
      setShowTypeChangeWarning(true);
    } else {
      // Status is valid, just change the type and reset any stale status selection
      setSelectedProjectType(newTypeId);
      setSelectedNewStatus(''); // Reset to avoid stale state
    }
  };

  // Confirm project type change (with new status if needed)
  const confirmProjectTypeChange = () => {
    if (pendingProjectType) {
      setSelectedProjectType(pendingProjectType);
      setPendingProjectType(null);
      setShowTypeChangeWarning(false);
      setNeedsStatusSelection(false);
      // Don't reset selectedNewStatus here - it's needed for the form submission
    }
  };

  // Cancel project type change
  const cancelProjectTypeChange = () => {
    setPendingProjectType(null);
    setShowTypeChangeWarning(false);
    setNeedsStatusSelection(false);
    setSelectedNewStatus('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Run comprehensive form validation
    const validation = validateProjectForm({
      selectedSalesperson,
      selectedProjectType,
      isEditing,
      salesOrderNumber,
      pocName,
      pocEmail,
      pocPhone,
      goalCompletionDate,
      createdDate,
      startDate,
      endDate,
      salesAmount,
      secondaryPocEmail,
    });

    if (!validation.valid) {
      toast.error(validation.error);
      // Set sales order error for UI feedback if applicable
      const salesOrderError = validateSalesOrderNumber(salesOrderNumber);
      if (salesOrderError) {
        setSalesOrderError(salesOrderError);
      }
      return;
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(pocPhone);

    // Clean and parse sales amount
    const cleanedSalesAmount = cleanSalesAmount(salesAmount);
    const parsedSalesAmount = cleanedSalesAmount ? parseFloat(cleanedSalesAmount) : null;

    const data = {
      client_name: clientName,
      sales_order_number: salesOrderNumber?.trim() || null,
      sales_order_url: formData.get('sales_order_url') as string || null,
      po_number: formData.get('po_number') as string || null,
      sales_amount: parsedSalesAmount,
      contract_type: formData.get('contract_type') as string || 'None',
      goal_completion_date: goalCompletionDate || null,
      salesperson_id: selectedSalesperson,
      poc_name: pocName || null,
      poc_email: pocEmail || null,
      poc_phone: formattedPhone || null,
      secondary_poc_email: secondaryPocEmail?.trim() || null,
      scope_link: formData.get('scope_link') as string || null,
      number_of_vidpods: numberOfVidpods ? parseInt(numberOfVidpods, 10) : null,
      vidpod_only: vidpodOnly,
      email_notifications_enabled: emailNotificationsEnabled,
      activecampaign_account_id: selectedAccount?.id || null,
      activecampaign_contact_id: selectedPrimaryContact?.id || null,
      secondary_activecampaign_contact_id: selectedSecondaryContact?.id || null,
      start_date: startDate || null,
      end_date: endDate || null,
      ...(isEditing && { created_date: createdDate }),
      // Include project type and status changes when editing
      ...(isEditing && selectedProjectType !== project?.project_type_id && {
        project_type_id: selectedProjectType,
        ...(selectedNewStatus && { current_status_id: selectedNewStatus }),
      }),
    };

    setIsPending(true);
    try {
      const supabase = createClient();

      if (isEditing) {
        // Check if sales order number is already used by another project
        if (data.sales_order_number && data.sales_order_number !== project.sales_order_number) {
          const { data: existingProject } = await supabase
            .from('projects')
            .select('id, client_name')
            .eq('sales_order_number', data.sales_order_number)
            .neq('id', project.id)
            .maybeSingle();

          if (existingProject) {
            toast.error(`Sales Order # ${data.sales_order_number} is already used by project "${existingProject.client_name}"`);
            setIsPending(false);
            return;
          }
        }

        // Get old values for audit
        const oldProject = project;

        // Update project
        const { error } = await supabase
          .from('projects')
          .update(data)
          .eq('id', project.id);

        if (error) {
          toast.error('Failed to update project');
          console.error(error);
          return;
        }

        // Log changes to audit and update tags in parallel (fire-and-forget for non-critical ops)
        const { data: { user } } = await supabase.auth.getUser();
        const changes: { field: string; oldVal: unknown; newVal: unknown }[] = [];

        Object.entries(data).forEach(([key, newVal]) => {
          const oldVal = oldProject[key as keyof typeof oldProject];
          if (String(oldVal || '') !== String(newVal || '')) {
            changes.push({ field: key, oldVal, newVal });
          }
        });

        // Run audit logs and tag updates in background (don't block the UI)
        (async () => {
          try {
            // Batch all audit log inserts
            if (changes.length > 0) {
              await supabase.from('audit_logs').insert(
                changes.map(change => ({
                  project_id: project.id,
                  user_id: user?.id,
                  action: 'update',
                  field_name: change.field,
                  old_value: String(change.oldVal || ''),
                  new_value: String(change.newVal || ''),
                }))
              );
            }

            // Update tags - delete then insert
            await supabase
              .from('project_tags')
              .delete()
              .eq('project_id', project.id);

            if (selectedTags.length > 0) {
              await supabase.from('project_tags').insert(
                selectedTags.map((tagId) => ({
                  project_id: project.id,
                  tag_id: tagId,
                }))
              );
            }
          } catch (err) {
            console.error('Background save error:', err);
            toast.warning('Some changes may not have been saved. Please refresh to verify.');
          }
        })();

        toast.success('Project updated successfully');
        router.refresh();
      } else {
        // Use server action for creating project (avoids browser Supabase client issues)
        const result = await createProject({
          client_name: data.client_name,
          sales_order_number: data.sales_order_number,
          sales_order_url: data.sales_order_url,
          po_number: data.po_number,
          sales_amount: data.sales_amount,
          contract_type: data.contract_type,
          goal_completion_date: data.goal_completion_date,
          salesperson_id: data.salesperson_id,
          poc_name: data.poc_name,
          poc_email: data.poc_email,
          poc_phone: data.poc_phone,
          secondary_poc_email: data.secondary_poc_email,
          scope_link: data.scope_link,
          number_of_vidpods: data.number_of_vidpods,
          vidpod_only: data.vidpod_only,
          project_type_id: selectedProjectType,
          tags: selectedTags,
          email_notifications_enabled: emailNotificationsEnabled,
          activecampaign_account_id: data.activecampaign_account_id,
          activecampaign_contact_id: data.activecampaign_contact_id,
          secondary_activecampaign_contact_id: data.secondary_activecampaign_contact_id,
          start_date: data.start_date,
          end_date: data.end_date,
        });

        if (!result.success) {
          toast.error(result.error || 'Failed to create project');
          return;
        }

        // Send welcome email to POC (fire-and-forget with timeout)
        if (data.poc_email && result.clientToken) {
          const selectedProjectTypeName = projectTypes.find(t => t.id === selectedProjectType)?.name || 'Project';
          // Get first status name for the email
          const availableStatuses = getAvailableStatuses(selectedProjectType);
          const firstStatus = availableStatuses.sort((a, b) => a.display_order - b.display_order)[0];

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          fetch('/api/email/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: data.poc_email,
              clientName: data.client_name,
              pocName: data.poc_name,
              projectType: selectedProjectTypeName,
              initialStatus: firstStatus?.name || 'Started',
              clientToken: result.clientToken,
            }),
            signal: controller.signal,
          })
            .catch((error) => {
              console.error('Failed to send welcome email:', error);
            })
            .finally(() => {
              clearTimeout(timeoutId);
            });
        }

        toast.success('Project created successfully');
        router.push(`/projects/${result.salesOrderNumber}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsPending(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Client Name with Active Campaign Autocomplete */}
        <ClientNameAutocomplete
          value={clientName}
          onChange={setClientName}
          onAccountSelect={setSelectedAccount}
          onContactFromEmail={(contact) => {
            // Auto-fill POC fields from email contact search
            const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            if (fullName) setPocName(fullName);
            if (contact.email) setPocEmail(contact.email);
            if (contact.phone) {
              // Strip +1 and format phone
              const cleanPhone = contact.phone.replace(/^\+1\s*/, '').replace(/^1(?=\d{10})/, '');
              setPocPhone(formatPhoneNumber(cleanPhone));
            }
          }}
          selectedAccount={selectedAccount}
          defaultValue={project?.client_name}
        />

        {/* Project Type */}
        <div className="space-y-2">
          <Label htmlFor="project_type">Project Type *</Label>
          <Select
            value={selectedProjectType}
            onValueChange={handleProjectTypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select project type" />
            </SelectTrigger>
            <SelectContent>
              {projectTypes.filter(t => t.is_active).map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isEditing && selectedProjectType !== project?.project_type_id && (
            <p className="text-xs text-amber-600">
              Changing project type may affect available statuses
            </p>
          )}
        </div>

        {/* Created Date - only show when editing */}
        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="created_date">Created Date</Label>
            <Input
              id="created_date"
              name="created_date"
              type="date"
              min="2024-01-01"
              max="2030-12-31"
              value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Original project creation date (2024-2030)
            </p>
          </div>
        )}

        {/* Contract Type */}
        <div className="space-y-2">
          <Label htmlFor="contract_type">Contract Type</Label>
          <Select name="contract_type" defaultValue={project?.contract_type || 'None'}>
            <SelectTrigger>
              <SelectValue placeholder="Select contract type" />
            </SelectTrigger>
            <SelectContent>
              {CONTRACT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Salesperson - hidden when editing (editable in Quick Info) */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="salesperson">Salesperson *</Label>
            <Select
              value={selectedSalesperson}
              onValueChange={setSelectedSalesperson}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                {salespeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name || person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* PO Number */}
        <div className="space-y-2">
          <Label htmlFor="po_number">PO Number</Label>
          <Input
            id="po_number"
            name="po_number"
            defaultValue={project?.po_number || ''}
          />
        </div>

        {/* Number of VidPODs */}
        <div className="space-y-2">
          <Label htmlFor="number_of_vidpods">Number of VidPODs</Label>
          <Input
            id="number_of_vidpods"
            name="number_of_vidpods"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={numberOfVidpods}
            onChange={(e) => setNumberOfVidpods(e.target.value)}
          />
        </div>

        {/* VidPOD Only */}
        <div className="flex items-center space-x-2 self-end pb-2">
          <Switch
            id="vidpod_only"
            checked={vidpodOnly}
            onCheckedChange={setVidpodOnly}
          />
          <Label htmlFor="vidpod_only">VidPOD Only</Label>
        </div>

        {/* Sales Amount - hidden when editing (editable in Quick Info) */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="sales_amount">Sales Amount w/o Tax ($)</Label>
            <Input
              id="sales_amount"
              name="sales_amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={salesAmount}
              onChange={(e) => {
                // Allow digits, commas, dollar signs, and decimal point
                const value = e.target.value;
                setSalesAmount(value);
              }}
              onBlur={() => {
                // Auto-clean on blur: remove $ and , and format
                const cleaned = cleanSalesAmount(salesAmount);
                if (cleaned && !isNaN(parseFloat(cleaned))) {
                  setSalesAmount(cleaned);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              You can enter values like $1,234.56 - they will be cleaned automatically
            </p>
          </div>
        )}

        {/* Sales Order Number - hidden when editing (editable in Quick Info) */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="sales_order_number">Sales Order # *</Label>
            <Input
              id="sales_order_number"
              name="sales_order_number"
              value={salesOrderNumber}
              onChange={(e) => {
                setSalesOrderNumber(e.target.value.toUpperCase());
                setSalesOrderError(null);
              }}
              placeholder="S1XXXX"
              maxLength={6}
              className={salesOrderError ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Must start with &quot;S1&quot; and be exactly 6 characters (e.g., S12345)
            </p>
            {salesOrderError && (
              <p className="text-xs text-destructive">{salesOrderError}</p>
            )}
          </div>
        )}

        {/* Sales Order URL (Odoo) - hidden when editing (editable in Quick Info) */}
        {!isEditing && (
          <div className="space-y-2">
            <Label htmlFor="sales_order_url">Sales Order URL (Odoo)</Label>
            <Input
              id="sales_order_url"
              name="sales_order_url"
              type="url"
              placeholder="https://odoo.example.com/..."
            />
          </div>
        )}

        {/* Scope Link */}
        <div className="space-y-2">
          <Label htmlFor="scope_link">Scope Link (OneDrive)</Label>
          <Input
            id="scope_link"
            name="scope_link"
            type="url"
            placeholder="https://onedrive.com/..."
            defaultValue={project?.scope_link || ''}
          />
        </div>

      </div>

      {/* Project Schedule Section - hidden when editing (editable in Quick Info) */}
      {!isEditing && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Project Schedule</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Set the goal date and schedule for this project. These dates are used for calendar scheduling and customer visibility.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Goal Completion Date */}
            <div className="space-y-2">
              <Label htmlFor="goal_completion_date">Goal Completion Date</Label>
              <Input
                id="goal_completion_date"
                name="goal_completion_date"
                type="date"
                min="2024-01-01"
                max="2030-12-31"
                value={goalCompletionDate}
                onChange={(e) => setGoalCompletionDate(e.target.value)}
              />
              {selectedProjectType && goalCompletionDate && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated based on {projectTypes.find(t => t.id === selectedProjectType)?.name || 'project type'}
                </p>
              )}
              {!selectedProjectType && (
                <p className="text-xs text-muted-foreground">
                  Select a project type to auto-calculate
                </p>
              )}
            </div>

            {/* Placeholder for grid alignment */}
            <div className="hidden md:block" />

            {/* Project Date Range Picker */}
            <div className="md:col-span-2">
              <ProjectDatePicker
                startDate={startDate || null}
                endDate={endDate || null}
                onDateChange={(newStart, newEnd) => {
                  setStartDate(newStart || '');
                  setEndDate(newEnd || '');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Primary Point of Contact with AC Integration */}
      <ContactSelector
        accountId={selectedAccount?.id || null}
        accountName={selectedAccount?.name || clientName}
        pocName={pocName}
        pocEmail={pocEmail}
        pocPhone={pocPhone}
        onPocNameChange={setPocName}
        onPocEmailChange={setPocEmail}
        onPocPhoneChange={setPocPhone}
        onContactSelect={setSelectedPrimaryContact}
        defaultPocName={project?.poc_name || ''}
        defaultPocEmail={project?.poc_email || ''}
        defaultPocPhone={project?.poc_phone || ''}
      />

      {/* Secondary Contact with AC Integration */}
      <SecondaryContactSelector
        contacts={acContacts}
        isLoading={acContactsLoading}
        email={secondaryPocEmail}
        onEmailChange={setSecondaryPocEmail}
        onContactSelect={setSelectedSecondaryContact}
        defaultEmail={project?.secondary_poc_email || ''}
      />

      {/* Email Notifications */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email-notifications" className="font-medium">
                Email Notifications
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Send email notifications to the point of contact when the project status changes.
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={emailNotificationsEnabled}
            onCheckedChange={setEmailNotificationsEnabled}
          />
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="border-t pt-4">
          <Label className="mb-3 block">Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  selectedTags.includes(tag.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-input'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>

      {/* Project Type Change Warning Dialog */}
      <AlertDialog open={showTypeChangeWarning} onOpenChange={setShowTypeChangeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Project Type Change
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Changing the project type will affect the available statuses for this project.
                </p>
                {needsStatusSelection && pendingProjectType && (
                  <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      The current status is not available in the new project type. Please select a new status.
                    </AlertDescription>
                  </Alert>
                )}
                {needsStatusSelection && pendingProjectType && (
                  <div className="space-y-2">
                    <Label>Select New Status *</Label>
                    <Select
                      value={selectedNewStatus}
                      onValueChange={setSelectedNewStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableStatuses(pendingProjectType).map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelProjectTypeChange}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmProjectTypeChange}
              disabled={needsStatusSelection && !selectedNewStatus}
            >
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
