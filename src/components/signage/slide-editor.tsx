'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  LayoutDashboard,
  List,
  TrendingUp,
  Clock,
  Users,
  Heart,
  AlertTriangle,
  Gauge,
  BarChart3,
  GitBranch,
  Timer,
} from 'lucide-react';
import {
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  type SignageSlide,
  type SlideType,
} from '@/app/(dashboard)/admin/signage/actions';

interface SlideEditorProps {
  slides: SignageSlide[];
  onSlidesChange: () => void;
}

const SLIDE_TYPES: { value: SlideType; label: string; icon: React.ReactNode; description: string }[] = [
  // Original slides
  { value: 'project-list', label: 'Project List', icon: <List className="h-4 w-4" />, description: 'Grid view of active projects with status, client, and dates' },
  { value: 'project-metrics', label: 'Project Metrics', icon: <TrendingUp className="h-4 w-4" />, description: 'KPIs and charts showing project counts and trends' },
  { value: 'po-ticker', label: 'PO Ticker', icon: <Clock className="h-4 w-4" />, description: 'Scrolling ticker of recent purchase orders' },
  { value: 'revenue-dashboard', label: 'Revenue Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, description: 'Revenue goals, actuals, and monthly breakdown' },
  { value: 'team-schedule', label: 'Team Schedule', icon: <Users className="h-4 w-4" />, description: 'Team member availability and assignments' },
  // New dashboard slides
  { value: 'health-dashboard', label: 'Health Dashboard', icon: <Heart className="h-4 w-4" />, description: 'Business health gauges showing sales and operations health percentages' },
  { value: 'alerts-dashboard', label: 'Alerts Dashboard', icon: <AlertTriangle className="h-4 w-4" />, description: 'Overdue and stuck projects with attention indicators' },
  { value: 'performance-metrics', label: 'Performance Metrics', icon: <Gauge className="h-4 w-4" />, description: 'KPIs: On-time %, DTI, backlog depth, customer concentration' },
  { value: 'velocity-chart', label: 'Velocity Chart', icon: <BarChart3 className="h-4 w-4" />, description: 'PO intake vs invoice completion trend over 6 months' },
  { value: 'status-pipeline', label: 'Status Pipeline', icon: <GitBranch className="h-4 w-4" />, description: 'Project workflow funnel with counts and revenue per status' },
  { value: 'cycle-time', label: 'Cycle Time', icon: <Timer className="h-4 w-4" />, description: 'Average days spent in each status stage' },
];

function getSlideTypeInfo(type: SlideType) {
  return SLIDE_TYPES.find(t => t.value === type) || SLIDE_TYPES[0];
}

export function SlideEditor({ slides, onSlidesChange }: SlideEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SignageSlide | null>(null);
  const [deleteConfirmSlide, setDeleteConfirmSlide] = useState<SignageSlide | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New slide form state
  const [newSlideType, setNewSlideType] = useState<SlideType>('project-list');
  const [newSlideTitle, setNewSlideTitle] = useState('');

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(15000);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});

  const handleAddSlide = async () => {
    setIsLoading(true);
    const result = await createSlide({
      slide_type: newSlideType,
      title: newSlideTitle || getSlideTypeInfo(newSlideType).label,
      enabled: true,
      duration_ms: 15000,
    });
    setIsLoading(false);

    if (result) {
      setIsAddDialogOpen(false);
      setNewSlideType('project-list');
      setNewSlideTitle('');
      onSlidesChange();
    }
  };

  const handleEditSlide = (slide: SignageSlide) => {
    setEditingSlide(slide);
    setEditTitle(slide.title || '');
    setEditDuration(slide.duration_ms);
    setEditEnabled(slide.enabled);
    setEditConfig(slide.config);
  };

  const handleSaveEdit = async () => {
    if (!editingSlide) return;

    setIsLoading(true);
    const result = await updateSlide(editingSlide.id, {
      title: editTitle || null,
      duration_ms: editDuration,
      enabled: editEnabled,
      config: editConfig,
    });
    setIsLoading(false);

    if (result) {
      setEditingSlide(null);
      onSlidesChange();
    }
  };

  const handleDeleteSlide = async () => {
    if (!deleteConfirmSlide) return;

    setIsLoading(true);
    const success = await deleteSlide(deleteConfirmSlide.id);
    setIsLoading(false);

    if (success) {
      setDeleteConfirmSlide(null);
      onSlidesChange();
    }
  };

  const handleToggleEnabled = async (slide: SignageSlide) => {
    await updateSlide(slide.id, { enabled: !slide.enabled });
    onSlidesChange();
  };

  const handleDurationChange = async (slide: SignageSlide, duration: number) => {
    await updateSlide(slide.id, { duration_ms: duration });
    onSlidesChange();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Slide Configuration</CardTitle>
            <CardDescription>Manage slides shown on the digital signage display</CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Slide
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {slides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No slides configured. Add a slide to get started.
          </div>
        ) : (
          slides.map((slide) => {
            const typeInfo = getSlideTypeInfo(slide.slide_type);
            return (
              <div
                key={slide.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />

                <Switch
                  checked={slide.enabled}
                  onCheckedChange={() => handleToggleEnabled(slide)}
                />

                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-muted rounded-md">
                    {typeInfo.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {slide.title || typeInfo.label}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {typeInfo.label}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-64">
                  <Label className="text-sm whitespace-nowrap min-w-[40px]">
                    {(slide.duration_ms / 1000).toFixed(0)}s
                  </Label>
                  <Slider
                    value={[slide.duration_ms]}
                    min={5000}
                    max={60000}
                    step={1000}
                    onValueCommit={(value) => handleDurationChange(slide, value[0])}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditSlide(slide)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmSlide(slide)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Add Slide Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Slide</DialogTitle>
            <DialogDescription>
              Choose a slide type to add to your signage display.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Slide Type</Label>
              <Select value={newSlideType} onValueChange={(v) => setNewSlideType(v as SlideType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getSlideTypeInfo(newSlideType).description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Custom Title (optional)</Label>
              <Input
                value={newSlideTitle}
                onChange={(e) => setNewSlideTitle(e.target.value)}
                placeholder={getSlideTypeInfo(newSlideType).label}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSlide} disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Slide'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Slide Dialog */}
      <Dialog open={!!editingSlide} onOpenChange={() => setEditingSlide(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Slide</DialogTitle>
            <DialogDescription>
              Customize the slide settings.
            </DialogDescription>
          </DialogHeader>

          {editingSlide && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={getSlideTypeInfo(editingSlide.slide_type).label}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration: {(editDuration / 1000).toFixed(0)} seconds</Label>
                <Slider
                  value={[editDuration]}
                  min={5000}
                  max={60000}
                  step={1000}
                  onValueChange={(value) => setEditDuration(value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch
                  checked={editEnabled}
                  onCheckedChange={setEditEnabled}
                />
              </div>

              {/* Type-specific config fields */}
              {(editingSlide.slide_type === 'project-list') && (
                <div className="space-y-2">
                  <Label>Max Items</Label>
                  <Input
                    type="number"
                    value={(editConfig.maxItems as number) || 15}
                    onChange={(e) => setEditConfig({ ...editConfig, maxItems: parseInt(e.target.value) || 15 })}
                    min={1}
                    max={30}
                  />
                </div>
              )}

              {editingSlide.slide_type === 'po-ticker' && (
                <div className="space-y-2">
                  <Label>Scroll Speed</Label>
                  <Slider
                    value={[(editConfig.scrollSpeed as number) || 2]}
                    min={1}
                    max={5}
                    step={0.5}
                    onValueChange={(value) => setEditConfig({ ...editConfig, scrollSpeed: value[0] })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSlide(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmSlide} onOpenChange={() => setDeleteConfirmSlide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Slide?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteConfirmSlide?.title || getSlideTypeInfo(deleteConfirmSlide?.slide_type || 'project-list').label}&quot; slide.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlide}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
