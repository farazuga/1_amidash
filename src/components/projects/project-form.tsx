'use client';

import { useState, useTransition } from 'react';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONTRACT_TYPES } from '@/lib/constants';
import type { Project, Status, Tag, Profile, ProjectType } from '@/types';

interface ProjectFormProps {
  project?: Project;
  statuses: Status[];
  tags: Tag[];
  projectTags?: string[];
  salespeople: Profile[];
  projectTypes: ProjectType[];
  projectTypeStatuses: { project_type_id: string; status_id: string }[];
}

export function ProjectForm({
  project,
  statuses,
  tags,
  projectTags = [],
  salespeople,
  projectTypes,
  projectTypeStatuses,
}: ProjectFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
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
    const pocName = formData.get('poc_name') as string;
    const pocEmail = formData.get('poc_email') as string;
    const pocPhone = formData.get('poc_phone') as string;

    if (!pocName?.trim() || !pocEmail?.trim() || !pocPhone?.trim()) {
      toast.error('All Point of Contact fields are required');
      return;
    }

    const data = {
      client_name: formData.get('client_name') as string,
      sales_order_number: salesOrderNumber?.trim() || null,
      sales_order_url: formData.get('sales_order_url') as string || null,
      po_number: formData.get('po_number') as string || null,
      sales_amount: formData.get('sales_amount')
        ? parseFloat(formData.get('sales_amount') as string)
        : null,
      contract_type: formData.get('contract_type') as string || 'None',
      goal_completion_date: formData.get('goal_completion_date') as string || null,
      salesperson_id: selectedSalesperson,
      poc_name: formData.get('poc_name') as string || null,
      poc_email: formData.get('poc_email') as string || null,
      poc_phone: formData.get('poc_phone') as string || null,
      scope_link: formData.get('scope_link') as string || null,
    };

    startTransition(async () => {
      try {
        if (isEditing) {
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

          // Log changes to audit
          const { data: { user } } = await supabase.auth.getUser();
          const changes: { field: string; oldVal: unknown; newVal: unknown }[] = [];

          Object.entries(data).forEach(([key, newVal]) => {
            const oldVal = oldProject[key as keyof typeof oldProject];
            if (String(oldVal || '') !== String(newVal || '')) {
              changes.push({ field: key, oldVal, newVal });
            }
          });

          for (const change of changes) {
            await supabase.from('audit_logs').insert({
              project_id: project.id,
              user_id: user?.id,
              action: 'update',
              field_name: change.field,
              old_value: String(change.oldVal || ''),
              new_value: String(change.newVal || ''),
            });
          }

          // Update tags
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

          toast.success('Project updated successfully');
          router.refresh();
        } else {
          // Get first status for the selected project type
          const availableStatuses = getAvailableStatuses(selectedProjectType);
          const firstStatus = availableStatuses.sort((a, b) => a.display_order - b.display_order)[0];

          if (!firstStatus) {
            toast.error('No statuses configured for this project type. Please configure statuses first.');
            return;
          }

          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError || !user) {
            toast.error('Session expired. Please log in again.');
            console.error('Auth error:', userError);
            return;
          }

          const { data: newProject, error } = await supabase
            .from('projects')
            .insert({
              ...data,
              project_type_id: selectedProjectType,
              current_status_id: firstStatus.id,
              created_by: user.id,
            })
            .select()
            .single();

          if (error) {
            toast.error('Failed to create project');
            console.error('Project insert error:', error);
            return;
          }

          // Add initial status history
          const { error: historyError } = await supabase.from('status_history').insert({
            project_id: newProject.id,
            status_id: firstStatus.id,
            changed_by: user.id,
          });

          if (historyError) {
            console.error('Status history error:', historyError);
            // Continue anyway - project was created
          }

          // Add tags
          if (selectedTags.length > 0) {
            const { error: tagsError } = await supabase.from('project_tags').insert(
              selectedTags.map((tagId) => ({
                project_id: newProject.id,
                tag_id: tagId,
              }))
            );
            if (tagsError) {
              console.error('Tags error:', tagsError);
            }
          }

          // Log creation
          const { error: auditError } = await supabase.from('audit_logs').insert({
            project_id: newProject.id,
            user_id: user.id,
            action: 'create',
            field_name: 'project',
            new_value: data.client_name,
          });

          if (auditError) {
            console.error('Audit log error:', auditError);
          }

          toast.success('Project created successfully');
          router.push(`/projects/${newProject.id}`);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        toast.error('An unexpected error occurred');
      }
    });
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
        {/* Client Name */}
        <div className="space-y-2">
          <Label htmlFor="client_name">Client Name *</Label>
          <Input
            id="client_name"
            name="client_name"
            defaultValue={project?.client_name}
            required
          />
        </div>

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
            type="number"
            step="0.01"
            min="0"
            defaultValue={project?.sales_amount || ''}
          />
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
            defaultValue={project?.goal_completion_date || ''}
          />
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

      <div className="border-t pt-4">
        <h3 className="font-medium mb-4">Point of Contact *</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="poc_name">Name *</Label>
            <Input
              id="poc_name"
              name="poc_name"
              defaultValue={project?.poc_name || ''}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poc_email">Email *</Label>
            <Input
              id="poc_email"
              name="poc_email"
              type="email"
              defaultValue={project?.poc_email || ''}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poc_phone">Phone *</Label>
            <Input
              id="poc_phone"
              name="poc_phone"
              type="tel"
              defaultValue={project?.poc_phone || ''}
              required
            />
          </div>
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
