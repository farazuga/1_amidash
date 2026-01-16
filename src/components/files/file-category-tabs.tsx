'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  FileCode,
  FileText,
  Image,
  File,
  FolderOpen
} from 'lucide-react';
import type { FileCategory, FileCategoryCount, FileCategoryWithLegacy } from '@/types';
import { cn } from '@/lib/utils';

interface FileCategoryTabsProps {
  activeCategory: FileCategory | 'all';
  onCategoryChange: (category: FileCategory | 'all') => void;
  counts: FileCategoryCount[];
  className?: string;
}

// Tab categories (4 main categories + 'all')
const categoryConfig: Record<FileCategory | 'all', {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  all: {
    label: 'All Files',
    icon: FolderOpen,
    color: 'text-gray-600',
  },
  schematics: {
    label: 'Schematics',
    icon: FileCode,
    color: 'text-blue-600',
  },
  sow: {
    label: 'SOW',
    icon: FileText,
    color: 'text-purple-600',
  },
  media: {
    label: 'Photos & Videos',
    icon: Image,
    color: 'text-green-600',
  },
  other: {
    label: 'Other',
    icon: File,
    color: 'text-gray-600',
  },
};

// Helper to normalize legacy categories to current ones for counting
function normalizeCategory(category: FileCategoryWithLegacy): FileCategory {
  if (category === 'photos' || category === 'videos') return 'media';
  return category;
}

export function FileCategoryTabs({
  activeCategory,
  onCategoryChange,
  counts,
  className,
}: FileCategoryTabsProps) {
  const getCount = (category: FileCategory | 'all'): number => {
    if (category === 'all') {
      return counts.reduce((sum, c) => sum + c.count, 0);
    }
    // Group legacy 'photos' and 'videos' into 'media' count
    if (category === 'media') {
      const mediaCount = counts.find(c => c.category === 'media')?.count || 0;
      const photosCount = counts.find(c => c.category === 'photos')?.count || 0;
      const videosCount = counts.find(c => c.category === 'videos')?.count || 0;
      return mediaCount + photosCount + videosCount;
    }
    return counts.find(c => c.category === category)?.count || 0;
  };

  // Only show main categories in tabs (not legacy photos/videos)
  const categories: (FileCategory | 'all')[] = ['all', 'schematics', 'sow', 'media', 'other'];

  return (
    <Tabs
      value={activeCategory}
      onValueChange={(value) => onCategoryChange(value as FileCategory | 'all')}
      className={className}
    >
      <TabsList className="grid w-full grid-cols-5 h-auto p-1">
        {categories.map((category) => {
          const config = categoryConfig[category];
          const Icon = config.icon;
          const count = getCount(category);

          return (
            <TabsTrigger
              key={category}
              value={category}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-3 data-[state=active]:bg-white',
                'data-[state=active]:shadow-sm'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-4 w-4', config.color)} />
                <span className="text-xs font-medium hidden sm:inline">
                  {config.label}
                </span>
              </div>
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 px-1.5 text-xs"
                >
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

// Mobile-friendly version with horizontal scroll
export function FileCategoryTabsMobile({
  activeCategory,
  onCategoryChange,
  counts,
  className,
}: FileCategoryTabsProps) {
  const getCount = (category: FileCategory | 'all'): number => {
    if (category === 'all') {
      return counts.reduce((sum, c) => sum + c.count, 0);
    }
    // Group legacy 'photos' and 'videos' into 'media' count
    if (category === 'media') {
      const mediaCount = counts.find(c => c.category === 'media')?.count || 0;
      const photosCount = counts.find(c => c.category === 'photos')?.count || 0;
      const videosCount = counts.find(c => c.category === 'videos')?.count || 0;
      return mediaCount + photosCount + videosCount;
    }
    return counts.find(c => c.category === category)?.count || 0;
  };

  // Only show main categories in tabs (not legacy photos/videos)
  const categories: (FileCategory | 'all')[] = ['all', 'schematics', 'sow', 'media', 'other'];

  return (
    <div className={cn('overflow-x-auto -mx-4 px-4', className)}>
      <div className="flex gap-2 pb-2">
        {categories.map((category) => {
          const config = categoryConfig[category];
          const Icon = config.icon;
          const count = getCount(category);
          const isActive = activeCategory === category;

          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap',
                'border transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? '' : config.color)} />
              <span className="text-sm font-medium">{config.label}</span>
              {count > 0 && (
                <Badge
                  variant={isActive ? 'secondary' : 'outline'}
                  className="h-5 px-1.5 text-xs"
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
