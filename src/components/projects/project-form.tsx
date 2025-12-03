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
import type { Project, Status, Tag } from '@/types';

interface ProjectFormProps {
  project?: Project;
  statuses: Status[];
  tags: Tag[];
  projectTags?: string[];
}

export function ProjectForm({
  project,
  statuses,
  tags,
  projectTags = [],
}: ProjectFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [selectedTags, setSelectedTags] = useState<string[]>(projectTags);

  const isEditing = !!project;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      client_name: formData.get('client_name') as string,
      sales_order_number: formData.get('sales_order_number') as string || null,
      sales_order_url: formData.get('sales_order_url') as string || null,
      po_number: formData.get('po_number') as string || null,
      sales_amount: formData.get('sales_amount')
        ? parseFloat(formData.get('sales_amount') as string)
        : null,
      contract_type: formData.get('contract_type') as string || null,
      goal_completion_date: formData.get('goal_completion_date') as string || null,
      poc_name: formData.get('poc_name') as string || null,
      poc_email: formData.get('poc_email') as string || null,
      poc_phone: formData.get('poc_phone') as string || null,
      scope_link: formData.get('scope_link') as string || null,
    };

    startTransition(async () => {
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
        // Get first status for new projects
        const firstStatus = statuses.find((s) => s.display_order === 1);

        const { data: { user } } = await supabase.auth.getUser();

        const { data: newProject, error } = await supabase
          .from('projects')
          .insert({
            ...data,
            current_status_id: firstStatus?.id,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) {
          toast.error('Failed to create project');
          console.error(error);
          return;
        }

        // Add initial status history
        if (firstStatus) {
          await supabase.from('status_history').insert({
            project_id: newProject.id,
            status_id: firstStatus.id,
            changed_by: user?.id,
          });
        }

        // Add tags
        if (selectedTags.length > 0) {
          await supabase.from('project_tags').insert(
            selectedTags.map((tagId) => ({
              project_id: newProject.id,
              tag_id: tagId,
            }))
          );
        }

        // Log creation
        await supabase.from('audit_logs').insert({
          project_id: newProject.id,
          user_id: user?.id,
          action: 'create',
          field_name: 'project',
          new_value: data.client_name,
        });

        toast.success('Project created successfully');
        router.push(`/projects/${newProject.id}`);
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

        {/* Contract Type */}
        <div className="space-y-2">
          <Label htmlFor="contract_type">Contract Type</Label>
          <Select name="contract_type" defaultValue={project?.contract_type || ''}>
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
          <Label htmlFor="sales_amount">Sales Amount ($)</Label>
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
          <Label htmlFor="sales_order_number">Sales Order #</Label>
          <Input
            id="sales_order_number"
            name="sales_order_number"
            defaultValue={project?.sales_order_number || ''}
          />
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
        <h3 className="font-medium mb-4">Point of Contact</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="poc_name">Name</Label>
            <Input
              id="poc_name"
              name="poc_name"
              defaultValue={project?.poc_name || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poc_email">Email</Label>
            <Input
              id="poc_email"
              name="poc_email"
              type="email"
              defaultValue={project?.poc_email || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="poc_phone">Phone</Label>
            <Input
              id="poc_phone"
              name="poc_phone"
              type="tel"
              defaultValue={project?.poc_phone || ''}
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
