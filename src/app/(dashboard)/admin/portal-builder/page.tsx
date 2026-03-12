'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  Eye,
  LayoutTemplate,
  Code,
  Contact,
  ListChecks,
  Calendar,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PortalBlock, PortalBlockType, PortalTemplate, ProjectType } from '@/types';
import {
  usePortalTemplates,
  useCreatePortalTemplate,
  useUpdatePortalTemplate,
  useDeletePortalTemplate,
  useAssignTemplateToType,
} from '@/hooks/queries/use-portal-templates';
import { useProjectTypes } from '@/hooks/queries/use-statuses';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { EmailBrandingSection } from '@/components/admin/email-branding-section';

// Block type metadata
const BLOCK_TYPE_CONFIG: Record<
  PortalBlockType,
  { label: string; icon: typeof Activity; description: string }
> = {
  current_status: {
    label: 'Current Status',
    icon: Activity,
    description: 'Status badge, animation, and progress bar',
  },
  poc_info: {
    label: 'Contact Info',
    icon: Contact,
    description: 'Point of contact and project manager',
  },
  status_history: {
    label: 'Status History',
    icon: ListChecks,
    description: 'Timeline of status changes',
  },
  customer_schedule: {
    label: 'Schedule',
    icon: Calendar,
    description: 'Project start/end dates and progress',
  },
  custom_html: {
    label: 'Custom HTML',
    icon: Code,
    description: 'Custom HTML content block',
  },
};

function generateBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================
// Sortable Block Row
// ============================================
function SortableBlockRow({
  block,
  onDelete,
  onUpdateConfig,
}: {
  block: PortalBlock;
  onDelete: () => void;
  onUpdateConfig: (config: PortalBlock['config']) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = BLOCK_TYPE_CONFIG[block.type];
  const Icon = config.icon;

  return (
    <div ref={setNodeRef} style={style} className={cn('border rounded-lg bg-white', isDragging && 'opacity-50')}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="h-4 w-4 text-[#023A2D] flex-shrink-0" />
          <span className="text-sm font-medium">{config.label}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">{config.description}</span>
          {block.config?.title && (
            <Badge variant="outline" className="text-xs">
              {block.config.title}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {block.type === 'custom_html' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expandable config for custom_html blocks */}
      {block.type === 'custom_html' && expanded && (
        <div className="px-3 pb-3 pt-1 border-t space-y-2">
          <div>
            <Label className="text-xs">Title (optional)</Label>
            <Input
              value={block.config?.title || ''}
              onChange={(e) =>
                onUpdateConfig({ ...block.config, title: e.target.value || undefined })
              }
              placeholder="Section title..."
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">HTML Content</Label>
            <Textarea
              value={block.config?.content || ''}
              onChange={(e) =>
                onUpdateConfig({ ...block.config, content: e.target.value || undefined })
              }
              placeholder="<p>Your custom content here...</p>"
              rows={5}
              className="text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Page
// ============================================
export default function PortalBuilderPage() {
  const { data: templates = [], isLoading: templatesLoading } = usePortalTemplates();
  const { data: projectTypes = [], isLoading: typesLoading } = useProjectTypes();
  const createTemplate = useCreatePortalTemplate();
  const updateTemplate = useUpdatePortalTemplate();
  const deleteTemplate = useDeletePortalTemplate();
  const assignTemplate = useAssignTemplateToType();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingBlocks, setEditingBlocks] = useState<PortalBlock[] | null>(null);
  const [editingBgImage, setEditingBgImage] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(true);
  const [assignmentOpen, setAssignmentOpen] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const blocks = editingBlocks ?? selectedTemplate?.blocks ?? [];

  // Select a template for editing
  function selectTemplate(template: PortalTemplate) {
    setSelectedTemplateId(template.id);
    setEditingBlocks([...template.blocks]);
    setEditingBgImage(template.background_image_url || '');
  }

  // Save current block edits
  async function saveBlocks() {
    if (!selectedTemplateId || !editingBlocks) return;
    try {
      await updateTemplate.mutateAsync({
        id: selectedTemplateId,
        blocks: editingBlocks,
        background_image_url: editingBgImage.trim() || null,
      });
      setEditingBlocks(null);
      toast.success('Template saved');
    } catch (err) {
      console.error('Save template error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save template: ${message}`);
    }
  }

  // Discard edits
  function discardEdits() {
    if (selectedTemplate) {
      setEditingBlocks([...selectedTemplate.blocks]);
      setEditingBgImage(selectedTemplate.background_image_url || '');
    }
  }

  // Create new template
  async function handleCreateTemplate() {
    if (!newTemplateName.trim()) return;
    try {
      const created = await createTemplate.mutateAsync({
        name: newTemplateName.trim(),
        blocks: [
          { id: generateBlockId(), type: 'current_status' },
          { id: generateBlockId(), type: 'poc_info' },
          { id: generateBlockId(), type: 'status_history' },
        ],
      });
      setCreateDialogOpen(false);
      setNewTemplateName('');
      selectTemplate(created as PortalTemplate);
      toast.success('Template created');
    } catch (err) {
      console.error('Create template error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to create template: ${message}`);
    }
  }

  // Delete template
  async function handleDeleteTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (template?.is_default) {
      toast.error('Cannot delete the default template');
      return;
    }
    try {
      await deleteTemplate.mutateAsync(id);
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setEditingBlocks(null);
      }
      toast.success('Template deleted');
    } catch (err) {
      console.error('Delete template error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete template: ${message}`);
    }
  }

  // Rename template
  async function handleRenameTemplate() {
    if (!selectedTemplateId || !renameName.trim()) return;
    try {
      await updateTemplate.mutateAsync({ id: selectedTemplateId, name: renameName.trim() });
      setRenameDialogOpen(false);
      toast.success('Template renamed');
    } catch (err) {
      console.error('Rename template error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to rename template: ${message}`);
    }
  }

  // Drag end handler for blocks
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !editingBlocks) return;

    const oldIndex = editingBlocks.findIndex((b) => b.id === active.id);
    const newIndex = editingBlocks.findIndex((b) => b.id === over.id);
    setEditingBlocks(arrayMove(editingBlocks, oldIndex, newIndex));
  }

  // Add a block
  function addBlock(type: PortalBlockType) {
    if (!editingBlocks) return;
    const newBlock: PortalBlock = { id: generateBlockId(), type };
    setEditingBlocks([...editingBlocks, newBlock]);
  }

  // Remove a block
  function removeBlock(blockId: string) {
    if (!editingBlocks) return;
    setEditingBlocks(editingBlocks.filter((b) => b.id !== blockId));
  }

  // Update block config
  function updateBlockConfig(blockId: string, config: PortalBlock['config']) {
    if (!editingBlocks) return;
    setEditingBlocks(
      editingBlocks.map((b) => (b.id === blockId ? { ...b, config } : b))
    );
  }

  // Assign template to project type
  async function handleAssignTemplate(projectTypeId: string, templateId: string) {
    try {
      await assignTemplate.mutateAsync({
        projectTypeId,
        templateId: templateId || null,
      });
      toast.success('Template assigned');
    } catch (err) {
      console.error('Assign template error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to assign template: ${message}`);
    }
  }

  const hasUnsavedChanges =
    editingBlocks !== null &&
    selectedTemplate &&
    (JSON.stringify(editingBlocks) !== JSON.stringify(selectedTemplate.blocks) ||
     editingBgImage !== (selectedTemplate.background_image_url || ''));

  if (templatesLoading || typesLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <LayoutTemplate className="h-6 w-6 text-[#023A2D]" />
        <h1 className="text-2xl font-bold text-[#023A2D]">Portal Builder</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure which blocks appear on the customer-facing status page for each project type.
      </p>

      {/* ============================================ */}
      {/* SECTION 1: Templates List */}
      {/* ============================================ */}
      <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Templates</CardTitle>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', !templatesOpen && '-rotate-90')}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Blocks</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow
                      key={template.id}
                      className={cn(
                        'cursor-pointer',
                        selectedTemplateId === template.id && 'bg-muted/50'
                      )}
                      onClick={() => selectTemplate(template)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          {template.is_default && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{template.blocks.length} blocks</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTemplate(template);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!template.is_default && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Portal Template</DialogTitle>
                    <DialogDescription>
                      Create a new template with default blocks. You can customize it after creation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>Template Name</Label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g., VidPod Portal"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTemplate} disabled={!newTemplateName.trim()}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ============================================ */}
      {/* SECTION 2: Template Builder */}
      {/* ============================================ */}
      {selectedTemplate && editingBlocks && (
        <Collapsible open={builderOpen} onOpenChange={setBuilderOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">
                      Builder: {selectedTemplate.name}
                    </CardTitle>
                    {hasUnsavedChanges && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        Unsaved
                      </Badge>
                    )}
                  </div>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', !builderOpen && '-rotate-90')}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Rename + Preview */}
                <div className="flex items-center gap-2">
                  <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRenameName(selectedTemplate.name)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Rename
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Rename Template</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>Name</Label>
                        <Input
                          value={renameName}
                          onChange={(e) => setRenameName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameTemplate()}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleRenameTemplate}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Background Image URL */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Background Image URL</Label>
                  <Input
                    value={editingBgImage}
                    onChange={(e) => setEditingBgImage(e.target.value)}
                    placeholder="https://example.com/background.jpg"
                    className="h-8 text-sm"
                  />
                  {editingBgImage && (
                    <div className="mt-2 rounded border overflow-hidden h-24 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingBgImage}
                        alt="Background preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                {/* Block list with drag-and-drop */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={editingBlocks.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {editingBlocks.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
                          No blocks. Add one below.
                        </div>
                      )}
                      {editingBlocks.map((block) => (
                        <SortableBlockRow
                          key={block.id}
                          block={block}
                          onDelete={() => removeBlock(block.id)}
                          onUpdateConfig={(config) => updateBlockConfig(block.id, config)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {/* Add Block */}
                <div className="flex items-center gap-2">
                  <Select onValueChange={(value) => addBlock(value as PortalBlockType)}>
                    <SelectTrigger className="w-[200px] h-8 text-sm">
                      <SelectValue placeholder="Add block..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(BLOCK_TYPE_CONFIG) as [PortalBlockType, typeof BLOCK_TYPE_CONFIG[PortalBlockType]][]).map(
                        ([type, config]) => {
                          const Icon = config.icon;
                          return (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5" />
                                {config.label}
                              </div>
                            </SelectItem>
                          );
                        }
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Save / Discard */}
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button size="sm" onClick={saveBlocks} disabled={updateTemplate.isPending}>
                      Save Changes
                    </Button>
                    <Button variant="outline" size="sm" onClick={discardEdits}>
                      Discard
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ============================================ */}
      {/* SECTION 2b: Email Branding */}
      {/* ============================================ */}
      {selectedTemplate && <EmailBrandingSection portalTemplateId={selectedTemplate.id} />}

      {/* ============================================ */}
      {/* SECTION 3: Template Assignment */}
      {/* ============================================ */}
      <Collapsible open={assignmentOpen} onOpenChange={setAssignmentOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Template Assignment</CardTitle>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', !assignmentOpen && '-rotate-90')}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Type</TableHead>
                    <TableHead className="w-[220px]">Portal Template</TableHead>
                    <TableHead className="w-[80px]">Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(projectTypes as (ProjectType & { portal_template_id?: string | null })[])
                    .filter((pt) => pt.is_active)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((pt) => {
                      const currentTemplateId = pt.portal_template_id || '';
                      return (
                        <TableRow key={pt.id}>
                          <TableCell className="font-medium">{pt.name}</TableCell>
                          <TableCell>
                            <Select
                              value={currentTemplateId}
                              onValueChange={(value) => handleAssignTemplate(pt.id, value)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="No template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.name}
                                    {template.is_default ? ' (Default)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <PreviewButton projectTypeId={pt.id} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

// ============================================
// Preview Button - opens a real portal page
// ============================================
function PreviewButton({ projectTypeId }: { projectTypeId: string }) {
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: project } = await supabase
        .from('projects')
        .select('client_token')
        .eq('project_type_id', projectTypeId)
        .not('client_token', 'is', null)
        .limit(1)
        .single();

      if (project?.client_token) {
        window.open(`/status/${project.client_token}`, '_blank');
      } else {
        toast.error('No project with a portal token found for this type');
      }
    } catch {
      toast.error('Could not find a preview project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handlePreview}
      disabled={loading}
    >
      <Eye className="h-3.5 w-3.5" />
    </Button>
  );
}
