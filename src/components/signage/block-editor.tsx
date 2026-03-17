'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Pencil,
  Trash2,
  ShoppingCart,
  FileCheck,
  BarChart3,
  FileText,
  Image,
  GripVertical,
  X,
  Settings,
} from 'lucide-react';
import {
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  updateSignageSettings,
  uploadSignageImage,
  type SignageBlock,
  type BlockType,
  type BlockPosition,
} from '@/app/(dashboard)/admin/signage/actions';

// ===== Types & Constants =====

interface BlockEditorProps {
  blocks: SignageBlock[];
  settings: { rotation_interval_ms: number };
}

interface RichTextNode {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'po-highlight', label: 'PO Highlight', icon: <ShoppingCart className="h-4 w-4" />, description: 'Highlights recent purchase orders' },
  { value: 'projects-invoiced', label: 'Projects Invoiced', icon: <FileCheck className="h-4 w-4" />, description: 'Shows recently invoiced projects' },
  { value: 'quick-stats', label: 'Quick Stats', icon: <BarChart3 className="h-4 w-4" />, description: 'Key business metrics at a glance' },
  { value: 'rich-text', label: 'Rich Text', icon: <FileText className="h-4 w-4" />, description: 'Custom text with headings, paragraphs, and bullets' },
  { value: 'picture', label: 'Picture', icon: <Image className="h-4 w-4" />, description: 'Display an uploaded image' },
];

const POSITION_OPTIONS: { value: BlockPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
];

function getBlockTypeInfo(type: BlockType) {
  return BLOCK_TYPES.find((t) => t.value === type) || BLOCK_TYPES[0];
}

function getPositionBadgeVariant(position: BlockPosition): 'default' | 'secondary' | 'outline' {
  switch (position) {
    case 'left': return 'secondary';
    case 'right': return 'outline';
    case 'both': return 'default';
  }
}

// ===== Rich Text Content Editor =====

function RichTextContentEditor({
  nodes,
  onChange,
}: {
  nodes: RichTextNode[];
  onChange: (nodes: RichTextNode[]) => void;
}) {
  const addNode = (type: RichTextNode['type']) => {
    onChange([...nodes, { type, text: '' }]);
  };

  const updateNode = (index: number, updates: Partial<RichTextNode>) => {
    const updated = nodes.map((node, i) => (i === index ? { ...node, ...updates } : node));
    onChange(updated);
  };

  const removeNode = (index: number) => {
    onChange(nodes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label>Content</Label>
      {nodes.length === 0 && (
        <p className="text-sm text-muted-foreground">No content nodes yet. Add one below.</p>
      )}
      {nodes.map((node, index) => (
        <div key={index} className="flex items-start gap-2">
          <Select
            value={node.type}
            onValueChange={(v) => updateNode(index, { type: v as RichTextNode['type'] })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heading">Heading</SelectItem>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="bullet">Bullet</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={node.text}
            onChange={(e) => updateNode(index, { text: e.target.value })}
            placeholder={`Enter ${node.type} text...`}
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={() => removeNode(index)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => addNode('heading')}>
          + Heading
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('paragraph')}>
          + Paragraph
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('bullet')}>
          + Bullet
        </Button>
      </div>
    </div>
  );
}

// ===== Image Upload Field =====

function ImageUploadField({
  currentUrl,
  onUpload,
  isPending,
}: {
  currentUrl: string | null;
  onUpload: (url: string) => void;
  isPending: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const url = await uploadSignageImage(formData);
    setUploading(false);

    if (url) {
      onUpload(url);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Image</Label>
      {currentUrl && (
        <div className="relative w-full max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="Block image" className="rounded-md border max-h-40 object-contain" />
        </div>
      )}
      <Input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={uploading || isPending}
      />
      {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
    </div>
  );
}

// ===== Main Block Editor =====

export function BlockEditor({ blocks, settings }: BlockEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SignageBlock | null>(null);
  const [deleteConfirmBlock, setDeleteConfirmBlock] = useState<SignageBlock | null>(null);

  // Add form state
  const [newBlockType, setNewBlockType] = useState<BlockType>('quick-stats');
  const [newTitle, setNewTitle] = useState('');
  const [newPosition, setNewPosition] = useState<BlockPosition>('both');
  const [newRichTextNodes, setNewRichTextNodes] = useState<RichTextNode[]>([]);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editPosition, setEditPosition] = useState<BlockPosition>('both');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editRichTextNodes, setEditRichTextNodes] = useState<RichTextNode[]>([]);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);

  // Settings state
  const [rotationSeconds, setRotationSeconds] = useState(settings.rotation_interval_ms / 1000);

  const refresh = () => router.refresh();

  // ===== Add Block =====

  const resetAddForm = () => {
    setNewBlockType('quick-stats');
    setNewTitle('');
    setNewPosition('both');
    setNewRichTextNodes([]);
    setNewImageUrl(null);
  };

  const handleAddBlock = () => {
    startTransition(async () => {
      const content: Record<string, unknown> = {};
      if (newBlockType === 'rich-text') {
        content.nodes = newRichTextNodes;
      } else if (newBlockType === 'picture' && newImageUrl) {
        content.url = newImageUrl;
      }

      const result = await createBlock({
        block_type: newBlockType,
        title: newTitle || getBlockTypeInfo(newBlockType).label,
        content,
        position: newPosition,
        enabled: true,
      });

      if (result) {
        setIsAddDialogOpen(false);
        resetAddForm();
        refresh();
      }
    });
  };

  // ===== Edit Block =====

  const openEditDialog = (block: SignageBlock) => {
    setEditingBlock(block);
    setEditTitle(block.title);
    setEditPosition(block.position);
    setEditEnabled(block.enabled);
    if (block.block_type === 'rich-text') {
      setEditRichTextNodes((block.content?.nodes as RichTextNode[]) || []);
    }
    if (block.block_type === 'picture') {
      setEditImageUrl((block.content?.url as string) || null);
    }
  };

  const handleSaveEdit = () => {
    if (!editingBlock) return;

    startTransition(async () => {
      const content: Record<string, unknown> = { ...editingBlock.content };
      if (editingBlock.block_type === 'rich-text') {
        content.nodes = editRichTextNodes;
      } else if (editingBlock.block_type === 'picture' && editImageUrl) {
        content.url = editImageUrl;
      }

      const result = await updateBlock(editingBlock.id, {
        title: editTitle,
        position: editPosition,
        enabled: editEnabled,
        content,
      });

      if (result) {
        setEditingBlock(null);
        refresh();
      }
    });
  };

  // ===== Delete Block =====

  const handleDeleteBlock = () => {
    if (!deleteConfirmBlock) return;

    startTransition(async () => {
      const success = await deleteBlock(deleteConfirmBlock.id);
      if (success) {
        setDeleteConfirmBlock(null);
        refresh();
      }
    });
  };

  // ===== Toggle Enabled =====

  const handleToggleEnabled = (block: SignageBlock) => {
    startTransition(async () => {
      await updateBlock(block.id, { enabled: !block.enabled });
      refresh();
    });
  };

  // ===== Save Settings =====

  const handleSaveSettings = () => {
    startTransition(async () => {
      await updateSignageSettings({
        rotation_interval_ms: Math.round(rotationSeconds * 1000),
      });
      refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Block List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Block Configuration</CardTitle>
              <CardDescription>Manage content blocks shown on the digital signage display</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Block
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No blocks configured. Add a block to get started.
            </div>
          ) : (
            blocks.map((block) => {
              const typeInfo = getBlockTypeInfo(block.block_type);
              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                    block.enabled ? 'hover:bg-muted/50' : 'opacity-50 bg-muted/20'
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" />

                  <Switch
                    checked={block.enabled}
                    onCheckedChange={() => handleToggleEnabled(block)}
                    disabled={isPending}
                  />

                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-muted rounded-md shrink-0">
                      {typeInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{block.title}</div>
                      <div className="text-sm text-muted-foreground">{typeInfo.label}</div>
                    </div>
                  </div>

                  <Badge variant={getPositionBadgeVariant(block.position)} className="shrink-0">
                    {block.position === 'both' ? 'Both' : block.position === 'left' ? 'Left' : 'Right'}
                  </Badge>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(block)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmBlock(block)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Display Settings</CardTitle>
              <CardDescription>Configure signage rotation timing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="rotation-interval">Rotation Interval (seconds)</Label>
              <Input
                id="rotation-interval"
                type="number"
                value={rotationSeconds}
                onChange={(e) => setRotationSeconds(Number(e.target.value) || 15)}
                min={5}
                max={120}
                step={1}
                className="w-32"
              />
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={isPending || rotationSeconds === settings.rotation_interval_ms / 1000}
              variant="outline"
            >
              {isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Add Block Dialog ===== */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Block</DialogTitle>
            <DialogDescription>Choose a block type and configure it.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Block Type</Label>
              <Select value={newBlockType} onValueChange={(v) => setNewBlockType(v as BlockType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((type) => (
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
                {getBlockTypeInfo(newBlockType).description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={getBlockTypeInfo(newBlockType).label}
              />
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={newPosition} onValueChange={(v) => setNewPosition(v as BlockPosition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POSITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newBlockType === 'rich-text' && (
              <>
                <Separator />
                <RichTextContentEditor nodes={newRichTextNodes} onChange={setNewRichTextNodes} />
              </>
            )}

            {newBlockType === 'picture' && (
              <>
                <Separator />
                <ImageUploadField
                  currentUrl={newImageUrl}
                  onUpload={setNewImageUrl}
                  isPending={isPending}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetAddForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddBlock} disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Block'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Block Dialog ===== */}
      <Dialog open={!!editingBlock} onOpenChange={() => setEditingBlock(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Block</DialogTitle>
            <DialogDescription>
              {editingBlock && getBlockTypeInfo(editingBlock.block_type).label} block
            </DialogDescription>
          </DialogHeader>

          {editingBlock && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={getBlockTypeInfo(editingBlock.block_type).label}
                />
              </div>

              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={editPosition} onValueChange={(v) => setEditPosition(v as BlockPosition)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Enabled</Label>
                <Switch
                  checked={editEnabled}
                  onCheckedChange={setEditEnabled}
                />
              </div>

              {editingBlock.block_type === 'rich-text' && (
                <>
                  <Separator />
                  <RichTextContentEditor nodes={editRichTextNodes} onChange={setEditRichTextNodes} />
                </>
              )}

              {editingBlock.block_type === 'picture' && (
                <>
                  <Separator />
                  <ImageUploadField
                    currentUrl={editImageUrl}
                    onUpload={setEditImageUrl}
                    isPending={isPending}
                  />
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBlock(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <AlertDialog open={!!deleteConfirmBlock} onOpenChange={() => setDeleteConfirmBlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteConfirmBlock?.title}&quot; block.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBlock}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
