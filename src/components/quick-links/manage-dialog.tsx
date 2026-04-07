'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';
import {
  deleteCategory,
  deleteItem,
} from '@/app/(dashboard)/quick-links/actions';
import type { QuickLinkCategory, QuickLinkItem } from '@/types/quick-links';
import { CategoryForm } from './category-form';
import { ItemForm } from './item-form';

interface ManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: QuickLinkCategory[];
  items: QuickLinkItem[];
  onDataChange: () => void;
}

export function ManageDialog({
  open,
  onOpenChange,
  categories,
  items,
  onDataChange,
}: ManageDialogProps) {
  const [editingCategory, setEditingCategory] = useState<QuickLinkCategory | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingItem, setEditingItem] = useState<QuickLinkItem | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  function getParentLabel(cat: QuickLinkCategory): string | null {
    if (!cat.parent_id) return null;
    const parent = categoryMap.get(cat.parent_id);
    return parent ? `under ${parent.name}` : null;
  }

  function getCategoryName(categoryId: string): string {
    return categoryMap.get(categoryId)?.name ?? 'Unknown';
  }

  function truncateUrl(url: string, max = 40): string {
    if (url.length <= max) return url;
    return url.slice(0, max) + '...';
  }

  async function handleDeleteCategory(id: string) {
    setDeletingId(id);
    try {
      const result = await deleteCategory(id);
      if (result.success) {
        toast.success('Category deleted');
        onDataChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteItem(id: string) {
    setDeletingId(id);
    try {
      const result = await deleteItem(id);
      if (result.success) {
        toast.success('Link deleted');
        onDataChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to delete link');
    } finally {
      setDeletingId(null);
    }
  }

  function handleCategorySuccess() {
    setEditingCategory(null);
    setCreatingCategory(false);
    toast.success(editingCategory ? 'Category updated' : 'Category created');
    onDataChange();
  }

  function handleItemSuccess() {
    setEditingItem(null);
    setCreatingItem(false);
    toast.success(editingItem ? 'Link updated' : 'Link created');
    onDataChange();
  }

  const showCategoryForm = creatingCategory || editingCategory;
  const showItemForm = creatingItem || editingItem;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Quick Links</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCategory(null);
                    setCreatingCategory(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Category
                </Button>
              </div>

              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No categories yet. Create one to get started.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {categories.map((cat) => {
                    const parentLabel = getParentLabel(cat);
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                          {parentLabel && (
                            <p className="text-xs text-muted-foreground">{parentLabel}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setCreatingCategory(false);
                              setEditingCategory(cat);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete category</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{cat.name}&quot;? This will
                                  also delete all links and subcategories within it.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  disabled={deletingId === cat.id}
                                >
                                  {deletingId === cat.id ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Links Tab */}
            <TabsContent value="links" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setCreatingItem(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Link
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No links yet. Create one to get started.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {items.map((itm) => (
                    <div
                      key={itm.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{itm.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {truncateUrl(itm.url)} &middot; {getCategoryName(itm.category_id)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setCreatingItem(false);
                            setEditingItem(itm);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete link</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{itm.title}&quot;?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteItem(itm.id)}
                                disabled={deletingId === itm.id}
                              >
                                {deletingId === itm.id ? 'Deleting...' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Nested dialog for Category create/edit */}
      <Dialog
        open={!!showCategoryForm}
        onOpenChange={(o) => {
          if (!o) {
            setCreatingCategory(false);
            setEditingCategory(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          {showCategoryForm && (
            <CategoryForm
              category={editingCategory ?? undefined}
              categories={categories}
              onSuccess={handleCategorySuccess}
              onCancel={() => {
                setCreatingCategory(false);
                setEditingCategory(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Nested dialog for Item create/edit */}
      <Dialog
        open={!!showItemForm}
        onOpenChange={(o) => {
          if (!o) {
            setCreatingItem(false);
            setEditingItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Link' : 'New Link'}
            </DialogTitle>
          </DialogHeader>
          {showItemForm && (
            <ItemForm
              item={editingItem ?? undefined}
              categories={categories}
              onSuccess={handleItemSuccess}
              onCancel={() => {
                setCreatingItem(false);
                setEditingItem(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
