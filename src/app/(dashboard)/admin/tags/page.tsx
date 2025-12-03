'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Tag } from '@/types';

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    setTags(data || []);
    setIsLoading(false);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get('name') as string,
      color: formData.get('color') as string,
    };

    startTransition(async () => {
      if (editingTag) {
        const { error } = await supabase
          .from('tags')
          .update(data)
          .eq('id', editingTag.id);

        if (error) {
          toast.error('Failed to update tag');
          return;
        }
        toast.success('Tag updated');
      } else {
        const { error } = await supabase.from('tags').insert(data);

        if (error) {
          if (error.code === '23505') {
            toast.error('A tag with this name already exists');
          } else {
            toast.error('Failed to create tag');
          }
          return;
        }
        toast.success('Tag created');
      }

      setIsDialogOpen(false);
      setEditingTag(null);
      loadTags();
    });
  };

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      return;
    }

    const { error } = await supabase.from('tags').delete().eq('id', tag.id);

    if (error) {
      toast.error('Failed to delete tag');
      return;
    }

    toast.success('Tag deleted');
    loadTags();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tag Management</h1>
          <p className="text-muted-foreground">
            Create and manage project tags
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTag(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>
                  {editingTag ? 'Edit Tag' : 'Add New Tag'}
                </DialogTitle>
                <DialogDescription>
                  Configure the tag settings below
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tag Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingTag?.name || ''}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      name="color"
                      type="color"
                      defaultValue={editingTag?.color || '#023A2D'}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      value={editingTag?.color || '#023A2D'}
                      className="flex-1"
                      readOnly
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Tags</CardTitle>
          <CardDescription>
            Tags can be assigned to projects for organization and filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tags created yet. Create your first tag to get started.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <Badge
                    style={{ backgroundColor: tag.color, color: 'white' }}
                    className="text-sm"
                  >
                    {tag.name}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingTag(tag);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(tag)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
