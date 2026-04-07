'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createItem, updateItem } from '@/app/(dashboard)/quick-links/actions';
import type { QuickLinkCategory, QuickLinkItem } from '@/types/quick-links';

interface ItemFormProps {
  item?: QuickLinkItem;
  categories: QuickLinkCategory[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ItemForm({ item, categories, onSuccess, onCancel }: ItemFormProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [sortOrder, setSortOrder] = useState(item?.sort_order ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!item;

  // Build category options with indentation for subcategories
  const topLevel = categories.filter((c) => !c.parent_id);
  const categoryOptions: { id: string; label: string }[] = [];
  for (const parent of topLevel) {
    categoryOptions.push({ id: parent.id, label: parent.name });
    const children = categories.filter((c) => c.parent_id === parent.id);
    for (const child of children) {
      categoryOptions.push({ id: child.id, label: `\u2192 ${child.name}` });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: title.trim(),
      url: url.trim(),
      category_id: categoryId,
      description: description.trim() || null,
      icon: icon.trim() || null,
      sort_order: sortOrder,
    };

    try {
      const result = isEditing
        ? await updateItem(item.id, payload)
        : await createItem(payload);

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
        <Label htmlFor="item-title">Title *</Label>
        <Input
          id="item-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Link title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-url">URL *</Label>
        <Input
          id="item-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          type="url"
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-category">Category *</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger id="item-category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-description">Description</Label>
        <Textarea
          id="item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-icon">Icon</Label>
        <Input
          id="item-icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={50}
          placeholder="e.g. external-link"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-sort">Sort Order</Label>
        <Input
          id="item-sort"
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
          {saving ? 'Saving...' : isEditing ? 'Update Link' : 'Create Link'}
        </Button>
      </div>
    </form>
  );
}
