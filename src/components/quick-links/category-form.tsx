'use client';

import { useState } from 'react';
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
import { createCategory, updateCategory } from '@/app/(dashboard)/quick-links/actions';
import type { QuickLinkCategory } from '@/types/quick-links';

interface CategoryFormProps {
  category?: QuickLinkCategory;
  categories: QuickLinkCategory[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({
  category,
  categories,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState<string>(category?.parent_id ?? 'none');
  const [icon, setIcon] = useState(category?.icon ?? '');
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!category;

  // Only top-level categories can be parents; exclude self when editing
  const parentOptions = categories.filter(
    (c) => !c.parent_id && (!category || c.id !== category.id),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      parent_id: parentId === 'none' ? null : parentId,
      icon: icon.trim() || null,
      sort_order: sortOrder,
    };

    try {
      const result = isEditing
        ? await updateCategory(category.id, payload)
        : await createCategory(payload);

      if (!result.success) {
        setError(result.error);
      } else {
        onSuccess();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="cat-name">Name *</Label>
        <Input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Category name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-parent">Parent Category</Label>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger id="cat-parent">
            <SelectValue placeholder="None (top-level)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (top-level)</SelectItem>
            {parentOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-icon">Icon</Label>
        <Input
          id="cat-icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={50}
          placeholder="e.g. book-open"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cat-sort">Sort Order</Label>
        <Input
          id="cat-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? 'Update Category' : 'Create Category'}
        </Button>
      </div>
    </form>
  );
}
