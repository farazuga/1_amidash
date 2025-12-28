'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Pencil, Loader2, GripVertical, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { Status, ProjectType } from '@/types';
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

interface ProjectTypeStatusMap {
  [projectTypeId: string]: string[];
}

// Sortable row component for statuses
function SortableStatusRow({
  status,
  onEdit,
  onToggleActive,
  onToggleRequireNote,
  onToggleException,
}: {
  status: Status;
  onEdit: () => void;
  onToggleActive: () => void;
  onToggleRequireNote: () => void;
  onToggleException: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 bg-muted')}
    >
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{status.name}</span>
          {status.require_note && (
            <Badge variant="outline" className="text-xs">
              Note Required
            </Badge>
          )}
          {status.is_exception && (
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
              Exception
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={status.require_note ?? false}
          onCheckedChange={onToggleRequireNote}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={status.is_exception ?? false}
          onCheckedChange={onToggleException}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={status.is_active ?? false}
          onCheckedChange={onToggleActive}
        />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Sortable row component for project types
function SortableTypeRow({
  type,
  onEdit,
  onToggleActive,
}: {
  type: ProjectType;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 bg-muted')}
    >
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <span className="font-medium">{type.name}</span>
      </TableCell>
      <TableCell>
        <Switch
          checked={type.is_active ?? false}
          onCheckedChange={onToggleActive}
        />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function StatusesAdminPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [statusMap, setStatusMap] = useState<ProjectTypeStatusMap>({});
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible state
  const [typesOpen, setTypesOpen] = useState(true);
  const [statusesOpen, setStatusesOpen] = useState(true);
  const [matrixOpen, setMatrixOpen] = useState(true);

  // Status dialog state
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);

  // Project type dialog state
  const [editingType, setEditingType] = useState<ProjectType | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      const [statusesRes, typesRes, mapRes] = await Promise.all([
        supabase.from('statuses').select('*').order('display_order'),
        supabase.from('project_types').select('*').order('display_order'),
        supabase.from('project_type_statuses').select('*'),
      ]);

      if (cancelled) return;

      setStatuses((statusesRes.data || []) as Status[]);
      setProjectTypes((typesRes.data || []) as ProjectType[]);

      // Build the status map
      const map: ProjectTypeStatusMap = {};
      (mapRes.data || []).forEach((row: { project_type_id: string; status_id: string }) => {
        if (!map[row.project_type_id]) {
          map[row.project_type_id] = [];
        }
        map[row.project_type_id].push(row.status_id);
      });
      setStatusMap(map);

      setIsLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [supabase]);

  // Function to reload data after mutations
  const loadData = async () => {
    const [statusesRes, typesRes, mapRes] = await Promise.all([
      supabase.from('statuses').select('*').order('display_order'),
      supabase.from('project_types').select('*').order('display_order'),
      supabase.from('project_type_statuses').select('*'),
    ]);

    setStatuses((statusesRes.data || []) as Status[]);
    setProjectTypes((typesRes.data || []) as ProjectType[]);

    const map: ProjectTypeStatusMap = {};
    (mapRes.data || []).forEach((row: { project_type_id: string; status_id: string }) => {
      if (!map[row.project_type_id]) {
        map[row.project_type_id] = [];
      }
      map[row.project_type_id].push(row.status_id);
    });
    setStatusMap(map);
  };

  // Handle status reorder
  const handleStatusDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);

      const newStatuses = arrayMove(statuses, oldIndex, newIndex);
      setStatuses(newStatuses);

      // Update display_order in database
      const updates = newStatuses.map((status, index) => ({
        id: status.id,
        display_order: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('statuses')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      toast.success('Status order updated');
    }
  };

  // Handle project type reorder
  const handleTypeDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projectTypes.findIndex((t) => t.id === active.id);
      const newIndex = projectTypes.findIndex((t) => t.id === over.id);

      const newTypes = arrayMove(projectTypes, oldIndex, newIndex);
      setProjectTypes(newTypes);

      // Update display_order in database
      const updates = newTypes.map((type, index) => ({
        id: type.id,
        display_order: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('project_types')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }

      toast.success('Project type order updated');
    }
  };

  // Status CRUD
  const handleSaveStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      require_note: formData.get('require_note') === 'on',
      is_active: true,
    };

    startTransition(async () => {
      if (editingStatus) {
        const { error } = await supabase
          .from('statuses')
          .update(data)
          .eq('id', editingStatus.id);

        if (error) {
          toast.error('Failed to update status');
          return;
        }
        toast.success('Status updated');
      } else {
        const maxOrder = Math.max(...statuses.map(s => s.display_order), 0);
        const { error } = await supabase
          .from('statuses')
          .insert({ ...data, display_order: maxOrder + 1 });

        if (error) {
          toast.error('Failed to create status');
          return;
        }
        toast.success('Status created');
      }

      setIsStatusDialogOpen(false);
      setEditingStatus(null);
      loadData();
    });
  };

  const toggleStatusActive = async (status: Status) => {
    const { error } = await supabase
      .from('statuses')
      .update({ is_active: !status.is_active })
      .eq('id', status.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    loadData();
  };

  const toggleRequireNote = async (status: Status) => {
    const { error } = await supabase
      .from('statuses')
      .update({ require_note: !status.require_note })
      .eq('id', status.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    loadData();
    toast.success('Updated require note setting');
  };

  const toggleException = async (status: Status) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('statuses') as any)
      .update({ is_exception: !status.is_exception })
      .eq('id', status.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    loadData();
    toast.success('Updated exception setting');
  };

  // Project Type CRUD
  const handleSaveType = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      is_active: true,
    };

    startTransition(async () => {
      if (editingType) {
        const { error } = await supabase
          .from('project_types')
          .update(data)
          .eq('id', editingType.id);

        if (error) {
          toast.error('Failed to update project type');
          return;
        }
        toast.success('Project type updated');
      } else {
        const maxOrder = Math.max(...projectTypes.map(t => t.display_order), 0);
        const { error } = await supabase
          .from('project_types')
          .insert({ ...data, display_order: maxOrder + 1 });

        if (error) {
          toast.error('Failed to create project type');
          return;
        }
        toast.success('Project type created');
      }

      setIsTypeDialogOpen(false);
      setEditingType(null);
      loadData();
    });
  };

  const toggleTypeActive = async (type: ProjectType) => {
    const { error } = await supabase
      .from('project_types')
      .update({ is_active: !type.is_active })
      .eq('id', type.id);

    if (error) {
      toast.error('Failed to update project type');
      return;
    }

    loadData();
  };

  // Matrix toggle
  const toggleStatusForType = async (projectTypeId: string, statusId: string) => {
    const currentStatuses = statusMap[projectTypeId] || [];
    const isEnabled = currentStatuses.includes(statusId);

    if (isEnabled) {
      // Remove
      const { error } = await supabase
        .from('project_type_statuses')
        .delete()
        .eq('project_type_id', projectTypeId)
        .eq('status_id', statusId);

      if (error) {
        toast.error('Failed to update');
        return;
      }
    } else {
      // Add
      const { error } = await supabase
        .from('project_type_statuses')
        .insert({ project_type_id: projectTypeId, status_id: statusId });

      if (error) {
        toast.error('Failed to update');
        return;
      }
    }

    loadData();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const activeTypes = projectTypes.filter(t => t.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Status Management</h1>
        <p className="text-muted-foreground">
          Configure project types and their available statuses
        </p>
      </div>

      {/* Project Types Section */}
      <Collapsible open={typesOpen} onOpenChange={setTypesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !typesOpen && "-rotate-90")} />
                <div>
                  <CardTitle>Project Types</CardTitle>
                  <CardDescription>
                    Define types of projects. Each type can have different available statuses.
                  </CardDescription>
                </div>
              </div>
              <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={(e) => { e.stopPropagation(); setEditingType(null); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Type
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSaveType}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingType ? 'Edit Project Type' : 'Add New Project Type'}
                      </DialogTitle>
                      <DialogDescription>
                        Configure the project type settings below
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="type-name">Type Name</Label>
                        <Input
                          id="type-name"
                          name="name"
                          defaultValue={editingType?.name || ''}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTypeDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Type Name</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={projectTypes.map(t => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {projectTypes.map((type) => (
                        <SortableTypeRow
                          key={type.id}
                          type={type}
                          onEdit={() => {
                            setEditingType(type);
                            setIsTypeDialogOpen(true);
                          }}
                          onToggleActive={() => toggleTypeActive(type)}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Statuses Section */}
      <Collapsible open={statusesOpen} onOpenChange={setStatusesOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !statusesOpen && "-rotate-90")} />
                <div>
                  <CardTitle>Statuses</CardTitle>
                  <CardDescription>
                    Define project statuses. Use the matrix below to assign statuses to project types.
                  </CardDescription>
                </div>
              </div>
              <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={(e) => { e.stopPropagation(); setEditingStatus(null); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Status
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSaveStatus}>
                    <DialogHeader>
                      <DialogTitle>
                        {editingStatus ? 'Edit Status' : 'Add New Status'}
                      </DialogTitle>
                      <DialogDescription>
                        Configure the status settings below
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Status Name</Label>
                        <Input
                          id="name"
                          name="name"
                          defaultValue={editingStatus?.name || ''}
                          required
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="require_note"
                          name="require_note"
                          defaultChecked={editingStatus?.require_note || false}
                        />
                        <Label htmlFor="require_note">Require note when selecting this status</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleStatusDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Status Name</TableHead>
                      <TableHead>Require Note</TableHead>
                      <TableHead>Exception</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={statuses.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {statuses.map((status) => (
                        <SortableStatusRow
                          key={status.id}
                          status={status}
                          onEdit={() => {
                            setEditingStatus(status);
                            setIsStatusDialogOpen(true);
                          }}
                          onToggleActive={() => toggleStatusActive(status)}
                          onToggleRequireNote={() => toggleRequireNote(status)}
                          onToggleException={() => toggleException(status)}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Status Matrix */}
      <Collapsible open={matrixOpen} onOpenChange={setMatrixOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !matrixOpen && "-rotate-90")} />
                <div>
                  <CardTitle>Status Availability Matrix</CardTitle>
                  <CardDescription>
                    Check which statuses are available for each project type
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Status</TableHead>
                      {activeTypes.map((type) => (
                        <TableHead key={type.id} className="text-center min-w-[120px]">
                          {type.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statuses.filter(s => s.is_active).map((status) => (
                      <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.name}</TableCell>
                        {activeTypes.map((type) => {
                          const isEnabled = (statusMap[type.id] || []).includes(status.id);
                          return (
                            <TableCell key={type.id} className="text-center">
                              <Checkbox
                                checked={isEnabled}
                                onCheckedChange={() => toggleStatusForType(type.id, status.id)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
