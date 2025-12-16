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
import { Loader2, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { CONTRACT_TYPES } from '@/lib/constants';
import type { Project, Tag, Profile, ProjectType } from '@/types';
import type { ACAccount, ACContact } from '@/types/activecampaign';
import { createProject } from '@/app/(dashboard)/projects/actions';
import { ClientNameAutocomplete } from './client-name-autocomplete';
import { ContactSelector } from './contact-selector';
import { SecondaryContactSelector } from './secondary-contact-selector';
import { useActiveCampaignContacts } from '@/hooks/use-activecampaign';

// Validation helpers
function cleanSalesAmount(value: string): string {
  // Remove $ and , characters, return cleaned number string
  return value.replace(/[$,]/g, '').trim();
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatPhoneNumber(phone: string): string {
  // Extract digits only for the first 10 characters
  const digits = phone.replace(/\D/g, '');

  // If we have at least 10 digits, format the first 10 as xxx-xxx-xxxx
  if (digits.length >= 10) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    // Keep any remaining characters (for extensions like "ext 123" or "x123")
    const remaining = phone.slice(phone.lastIndexOf(digits.slice(9, 10)) + 1).trim();
    // Check if there are additional characters after the 10th digit in the original
    const afterDigits = phone.replace(/^[\d\s\-().]+/, '').trim();
    if (afterDigits) {
      return `${formatted} ${afterDigits}`;
    }
    // If remaining digits exist beyond 10, add them as extension
    if (digits.length > 10) {
      return `${formatted} ext ${digits.slice(10)}`;
    }
    return formatted;
  }

  return phone; // Return as-is if less than 10 digits
}

function validateDateInRange(dateStr: string): boolean {
  if (!dateStr) return true; // Empty is valid
  const date = new Date(dateStr);
  const year = date.getFullYear();
  return year >= 2024 && year <= 2030;
}

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
    project?.sales_order_number || (project ? '' : 'S12')
  );
  const [salesOrderError, setSalesOrderError] = useState<string | null>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState<boolean>(
    project?.email_notifications_enabled ?? true
  );
  const [pocPhone, setPocPhone] = useState<string>(project?.poc_phone || '');
  const [salesAmount, setSalesAmount] = useState<string>(
    project?.sales_amount?.toString() || ''
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

  // Get statuses available for the selected project type
  const getAvailableStatuses = (projectTypeId: string) => {
    const statusIds = projectTypeStatuses
      .filter(pts => pts.project_type_id === projectTypeId)
      .map(pts => pts.status_id);
    return statuses.filter(s => statusIds.includes(s.id) && s.is_active);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Validate salesperson is selected
    if (!selectedSalesperson) {
      toast.error('Please select a salesperson');
      return;
    }

    // Validate project type is selected for new projects
    if (!isEditing && !selectedProjectType) {
      toast.error('Please select a project type');
      return;
    }

    // Validate Sales Order Number format (must start with S12 and be 6 characters)
    if (salesOrderNumber && salesOrderNumber.trim()) {
      const trimmedSalesOrder = salesOrderNumber.trim();
      if (!trimmedSalesOrder.startsWith('S12') || trimmedSalesOrder.length !== 6) {
        toast.error('Sales Order # must start with "S12" and be exactly 6 characters (e.g., S12345)');
        setSalesOrderError('Must start with "S12" and be exactly 6 characters');
        return;
      }
    }

    // Validate Point of Contact fields are all filled
    // Use state values for POC fields since they're controlled
    if (!pocName?.trim() || !pocEmail?.trim() || !pocPhone?.trim()) {
      toast.error('All Point of Contact fields are required');
      return;
    }

    // Validate email format
    if (!validateEmail(pocEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate phone has at least 10 digits
    const phoneDigits = pocPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Phone number must have at least 10 digits');
      return;
    }

    // Validate goal completion date range
    if (goalCompletionDate && !validateDateInRange(goalCompletionDate)) {
      toast.error('Goal completion date must be between 2024 and 2030');
      return;
    }

    // Validate created date range (for editing)
    if (createdDate && !validateDateInRange(createdDate)) {
      toast.error('Created date must be between 2024 and 2030');
      return;
    }

    // Validate project schedule dates
    if (startDate && !validateDateInRange(startDate)) {
      toast.error('Start date must be between 2024 and 2030');
      return;
    }
    if (endDate && !validateDateInRange(endDate)) {
      toast.error('End date must be between 2024 and 2030');
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(pocPhone);

    // Clean and parse sales amount
    const cleanedSalesAmount = cleanSalesAmount(salesAmount);
    const parsedSalesAmount = cleanedSalesAmount ? parseFloat(cleanedSalesAmount) : null;

    if (cleanedSalesAmount && (isNaN(parsedSalesAmount!) || parsedSalesAmount! < 0)) {
      toast.error('Please enter a valid sales amount');
      return;
    }

    // Validate secondary email format if provided
    if (secondaryPocEmail && secondaryPocEmail.trim() && !validateEmail(secondaryPocEmail.trim())) {
      toast.error('Please enter a valid secondary email address');
      return;
    }

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
      email_notifications_enabled: emailNotificationsEnabled,
      activecampaign_account_id: selectedAccount?.id || null,
      activecampaign_contact_id: selectedPrimaryContact?.id || null,
      secondary_activecampaign_contact_id: selectedSecondaryContact?.id || null,
      start_date: startDate || null,
      end_date: endDate || null,
      ...(isEditing && { created_date: createdDate }),
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
        router.push(`/projects/${result.projectId}`);
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
            onValueChange={setSelectedProjectType}
            disabled={isEditing}
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
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Project type cannot be changed after creation
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

        {/* Salesperson */}
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

        {/* PO Number */}
        <div className="space-y-2">
          <Label htmlFor="po_number">PO Number</Label>
          <Input
            id="po_number"
            name="po_number"
            defaultValue={project?.po_number || ''}
          />
        </div>

        {/* Sales Amount */}
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

        {/* Sales Order Number */}
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
            placeholder="S12XXX"
            maxLength={6}
            className={salesOrderError ? 'border-destructive' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Must start with &quot;S12&quot; and be exactly 6 characters (e.g., S12345)
          </p>
          {salesOrderError && (
            <p className="text-xs text-destructive">{salesOrderError}</p>
          )}
        </div>

        {/* Sales Order URL (Odoo) */}
        <div className="space-y-2">
          <Label htmlFor="sales_order_url">Sales Order URL (Odoo)</Label>
          <Input
            id="sales_order_url"
            name="sales_order_url"
            type="url"
            placeholder="https://odoo.example.com/..."
            defaultValue={project?.sales_order_url || ''}
          />
        </div>

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
          <p className="text-xs text-muted-foreground">
            Must be between 2024 and 2030
          </p>
        </div>

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

      {/* Project Schedule Section */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium mb-3">Project Schedule</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Set the start and end dates for this project. These dates are used for calendar scheduling and customer visibility.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              min="2024-01-01"
              max="2030-12-31"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              min="2024-01-01"
              max="2030-12-31"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

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
    </form>
  );
}
