'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  FolderSync,
  ExternalLink,
  CloudOff,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { FileCategoryTabs, FileCategoryTabsMobile } from './file-category-tabs';
import { FileCard, FileCardCompact } from './file-card';
import { FileUploadDialog, FileUploadData } from './file-upload-dialog';
import type {
  ProjectFile,
  FileCategory,
  FileCategoryCount,
  ProjectSharePointConnection,
} from '@/types';
import { cn } from '@/lib/utils';

interface FileBrowserProps {
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  counts: FileCategoryCount[];
  connection: ProjectSharePointConnection | null;
  globalSharePointConfigured?: boolean;
  isLoading?: boolean;
  onUpload: (files: FileUploadData[]) => Promise<void>;
  onSync?: () => Promise<void>;
  onDownload?: (file: ProjectFile) => void;
  onDelete?: (file: ProjectFile) => void;
  onShare?: (file: ProjectFile) => void;
  onPreview?: (file: ProjectFile) => void;
}

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'date' | 'size';
type SortOrder = 'asc' | 'desc';

export function FileBrowser({
  projectId,
  projectName,
  files,
  counts,
  connection,
  globalSharePointConfigured = false,
  isLoading,
  onUpload,
  onSync,
  onDownload,
  onDelete,
  onShare,
  onPreview,
}: FileBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(f => f.category === activeCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.file_name.toLowerCase().includes(query) ||
        f.notes?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.file_name.localeCompare(b.file_name);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'size':
          comparison = (a.file_size || 0) - (b.file_size || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, activeCategory, searchQuery, sortField, sortOrder]);

  const pendingCount = files.filter(f => f.upload_status !== 'uploaded').length;

  const handleSync = async () => {
    if (!onSync) return;
    setIsSyncing(true);
    try {
      await onSync();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Project Files</h2>
          {connection ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FolderSync className="h-4 w-4" />
              <span>Connected to SharePoint</span>
              <a
                href={connection.folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Open folder
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : globalSharePointConfigured ? (
            <p className="text-sm text-gray-500">
              Files will sync to SharePoint on upload
            </p>
          ) : (
            <p className="text-sm text-yellow-600">
              SharePoint not configured. Contact admin.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1 text-yellow-600 text-sm">
              <CloudOff className="h-4 w-4" />
              <span>Offline</span>
            </div>
          )}

          {/* Pending uploads badge */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm">
              <CloudOff className="h-3 w-3" />
              <span>{pendingCount} pending</span>
            </div>
          )}

          {/* Actions - show if connection exists OR if global config is set (auto-create on upload) */}
          {(connection || globalSharePointConfigured) ? (
            <>
              {connection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing || !isOnline}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', isSyncing && 'animate-spin')} />
                  Sync
                </Button>
              )}
              <Button size="sm" onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Category tabs - responsive */}
      <div className="hidden sm:block">
        <FileCategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          counts={counts}
        />
      </div>
      <div className="sm:hidden">
        <FileCategoryTabsMobile
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          counts={counts}
        />
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>

          {/* View mode toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Files grid/list */}
      {isLoading ? (
        <FileBrowserSkeleton viewMode={viewMode} />
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          hasFiles={files.length > 0}
          hasConnection={!!connection}
          globalSharePointConfigured={globalSharePointConfigured}
          onUpload={() => setShowUploadDialog(true)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onDownload={onDownload}
              onDelete={onDelete}
              onShare={onShare}
              onPreview={onPreview}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file) => (
            <FileCardCompact
              key={file.id}
              file={file}
              onDownload={onDownload}
              onDelete={onDelete}
              onShare={onShare}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <FileUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        projectId={projectId}
        onUpload={onUpload}
        defaultCategory={activeCategory === 'all' ? 'other' : activeCategory}
      />
    </div>
  );
}

function FileBrowserSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border overflow-hidden">
            <Skeleton className="aspect-[4/3]" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasFiles,
  hasConnection,
  globalSharePointConfigured,
  onUpload,
}: {
  hasFiles: boolean;
  hasConnection: boolean;
  globalSharePointConfigured?: boolean;
  onUpload: () => void;
}) {
  if (hasFiles) {
    // Has files but filter returned none
    return (
      <div className="text-center py-12">
        <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-medium text-gray-900 mb-1">No matching files</h3>
        <p className="text-gray-500">Try adjusting your search or filters</p>
      </div>
    );
  }

  // SharePoint not configured globally
  if (!globalSharePointConfigured) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <FolderSync className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <h3 className="font-medium text-gray-900 mb-1">SharePoint Not Configured</h3>
        <p className="text-gray-500 mb-4">
          Contact your administrator to configure SharePoint integration.
        </p>
      </div>
    );
  }

  // SharePoint configured, ready to upload (folder will be created on first upload)
  return (
    <div className="text-center py-12 border-2 border-dashed rounded-lg">
      <Upload className="h-12 w-12 mx-auto text-gray-300 mb-4" />
      <h3 className="font-medium text-gray-900 mb-1">No files yet</h3>
      <p className="text-gray-500 mb-4">
        {hasConnection
          ? 'Upload files or sync from SharePoint to get started'
          : 'Upload files to create project folder in SharePoint'}
      </p>
      <Button onClick={onUpload}>
        <Upload className="h-4 w-4 mr-2" />
        Upload Files
      </Button>
    </div>
  );
}

// Export for use in presales context
export { FileBrowserSkeleton, EmptyState };
