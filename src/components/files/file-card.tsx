'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileCode,
  FileText,
  Image,
  Video,
  File,
  Download,
  ExternalLink,
  MoreVertical,
  Trash2,
  Share2,
  Clock,
  User,
  CloudOff,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import type { ProjectFile, FileCategory, UploadStatus } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface FileCardProps {
  file: ProjectFile;
  onDownload?: (file: ProjectFile) => void;
  onDelete?: (file: ProjectFile) => void;
  onShare?: (file: ProjectFile) => void;
  onPreview?: (file: ProjectFile) => void;
  className?: string;
}

const categoryIcons: Record<FileCategory, React.ComponentType<{ className?: string }>> = {
  schematics: FileCode,
  sow: FileText,
  photos: Image,
  videos: Video,
  other: File,
};

const categoryColors: Record<FileCategory, string> = {
  schematics: 'bg-blue-100 text-blue-700',
  sow: 'bg-purple-100 text-purple-700',
  photos: 'bg-green-100 text-green-700',
  videos: 'bg-red-100 text-red-700',
  other: 'bg-gray-100 text-gray-700',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
}

function UploadStatusBadge({ status }: { status: UploadStatus }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300">
          <CloudOff className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'uploading':
      return (
        <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="gap-1 text-red-600 border-red-300">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

export function FileCard({
  file,
  onDownload,
  onDelete,
  onShare,
  onPreview,
  className,
}: FileCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const Icon = categoryIcons[file.category];
  const extension = getFileExtension(file.file_name);
  const isImage = file.category === 'photos' || file.mime_type?.startsWith('image/');
  const isVideo = file.category === 'videos' || file.mime_type?.startsWith('video/');
  const hasThumbnail = isImage || isVideo;
  const isPending = file.upload_status !== 'uploaded';
  // Use local thumbnail first (client-generated), fallback to SharePoint thumbnail
  const thumbnailUrl = file.local_thumbnail_url || file.thumbnail_url;

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-shadow hover:shadow-md',
        isPending && 'opacity-75',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail or Icon Preview */}
      <div
        className={cn(
          'relative aspect-[4/3] bg-gray-50 flex items-center justify-center',
          'border-b'
        )}
      >
        {hasThumbnail && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={file.file_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className={cn('h-12 w-12', categoryColors[file.category].split(' ')[1])} />
            {extension && (
              <span className="text-xs font-medium text-gray-500 uppercase">
                {extension}
              </span>
            )}
          </div>
        )}

        {/* Offline indicator */}
        {file.captured_offline && (
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <CloudOff className="h-3 w-3" />
              Offline
            </Badge>
          </div>
        )}

        {/* Upload status */}
        {isPending && (
          <div className="absolute top-2 right-2">
            <UploadStatusBadge status={file.upload_status} />
          </div>
        )}

        {/* Hover overlay with actions */}
        {isHovered && !isPending && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity">
            {onPreview && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onPreview(file)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
            )}
            {onDownload && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onDownload(file)}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* File name */}
            <p className="font-medium text-sm truncate" title={file.file_name}>
              {file.file_name}
            </p>

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{formatFileSize(file.file_size)}</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
              </span>
            </div>

            {/* Uploaded by */}
            {file.uploaded_by_profile && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <User className="h-3 w-3" />
                <span>{file.uploaded_by_profile.full_name || file.uploaded_by_profile.email}</span>
              </div>
            )}
          </div>

          {/* Actions menu */}
          {!isPending && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onPreview && (
                  <DropdownMenuItem onClick={() => onPreview(file)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem onClick={() => onDownload(file)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                )}
                {file.web_url && (
                  <DropdownMenuItem asChild>
                    <a href={file.web_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in SharePoint
                    </a>
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem onClick={() => onShare(file)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(file)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Category badge */}
        <div className="mt-2">
          <Badge className={cn('text-xs', categoryColors[file.category])}>
            {file.category.charAt(0).toUpperCase() + file.category.slice(1)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact list view variant
export function FileCardCompact({
  file,
  onDownload,
  onDelete,
  onShare,
  onPreview,
  className,
}: FileCardProps) {
  const Icon = categoryIcons[file.category];
  const extension = getFileExtension(file.file_name);
  const isPending = file.upload_status !== 'uploaded';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-white',
        'hover:shadow-sm transition-shadow',
        isPending && 'opacity-75',
        className
      )}
    >
      {/* Icon/Thumbnail */}
      <div
        className={cn(
          'flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center',
          categoryColors[file.category].split(' ')[0]
        )}
      >
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt=""
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <Icon className={cn('h-5 w-5', categoryColors[file.category].split(' ')[1])} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{file.file_name}</p>
          {file.captured_offline && (
            <CloudOff className="h-3 w-3 text-gray-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.file_size)} &bull;{' '}
          {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Status or Actions */}
      {isPending ? (
        <UploadStatusBadge status={file.upload_status} />
      ) : (
        <div className="flex items-center gap-1">
          {onPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(file)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(file)}
              className="h-8 w-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {file.web_url && (
                <DropdownMenuItem asChild>
                  <a href={file.web_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in SharePoint
                  </a>
                </DropdownMenuItem>
              )}
              {onShare && (
                <DropdownMenuItem onClick={() => onShare(file)}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(file)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
