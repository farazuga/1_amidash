'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { getQuickLinkCategories, getQuickLinkItems } from './actions';
import { buildCategoryTree, filterTree } from '@/lib/quick-links/utils';
import type { QuickLinkCategory, QuickLinkItem, QuickLinkCategoryTree } from '@/types/quick-links';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Link2,
  Search,
  Settings2,
  FolderOpen,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  LinkIcon,
} from 'lucide-react';
import { ManageDialog } from '@/components/quick-links/manage-dialog';

// ============================================
// CategorySection — recursive collapsible
// ============================================

function CategorySection({
  category,
  depth = 0,
}: {
  category: QuickLinkCategoryTree;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasContent = category.items.length > 0 || category.children.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={depth > 0 ? 'pl-6' : ''}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-3 rounded-md hover:bg-muted/50 text-left font-medium">
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>{category.name}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* Items */}
        {category.items.length > 0 && (
          <div className={`space-y-1 ${depth > 0 ? 'ml-6' : 'ml-6'} mt-1`}>
            {category.items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 group transition-colors"
              >
                <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">
                    {item.title}
                  </div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  )}
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {/* Child categories */}
        {category.children.length > 0 && (
          <div className="mt-1">
            {category.children.map((child) => (
              <CategorySection key={child.id} category={child} depth={depth + 1} />
            ))}
          </div>
        )}

        {/* Empty category */}
        {!hasContent && (
          <div className="ml-6 py-2 px-3 text-sm text-muted-foreground italic">
            No links in this category
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================
// Loading skeleton
// ============================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <div className="ml-6 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Page
// ============================================

export default function QuickLinksPage() {
  const { isAdmin } = useUser();
  const [categories, setCategories] = useState<QuickLinkCategory[]>([]);
  const [items, setItems] = useState<QuickLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [manageOpen, setManageOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catResult, itemResult] = await Promise.all([
      getQuickLinkCategories(),
      getQuickLinkItems(),
    ]);
    if (catResult.success) setCategories(catResult.data);
    if (itemResult.success) setItems(itemResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tree = useMemo(() => buildCategoryTree(categories, items), [categories, items]);
  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Quick Links
          </h1>
          <p className="text-muted-foreground">SOPs, documents, and useful resources</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Manage Links
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search links..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Link2 className="h-10 w-10 mb-3 opacity-40" />
          {query ? (
            <p>No links match &ldquo;{query}&rdquo;</p>
          ) : (
            <>
              <p className="text-lg font-medium">No links yet</p>
              <p className="text-sm mt-1">
                {isAdmin
                  ? 'Click "Manage Links" to add categories and links.'
                  : 'Links will appear here once an admin adds them.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((category) => (
            <CategorySection key={category.id} category={category} />
          ))}
        </div>
      )}

      {/* Admin manage dialog */}
      {isAdmin && (
        <ManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          categories={categories}
          items={items}
          onDataChange={loadData}
        />
      )}
    </div>
  );
}
