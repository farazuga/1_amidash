'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Camera,
  Video,
  X,
  FileCode,
  FileText,
  Image,
  File,
  CloudOff,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { FileCategory } from '@/types';
import { cn } from '@/lib/utils';
import { FILE_CATEGORY_CONFIG } from '@/types';
import { CustomCameraUI } from './custom-camera-ui';
import { isGetUserMediaSupported } from '@/lib/video-utils';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  dealId?: string;  // For presales files
  onUpload: (files: FileUploadData[]) => Promise<void>;
  defaultCategory?: FileCategory;
}

export interface FileUploadData {
  file: File;
  category: FileCategory;
  notes?: string;
}

interface PendingFile {
  id: string;
  file: File;
  preview?: string;
  category: FileCategory;
  notes?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const categoryIcons: Record<FileCategory, React.ComponentType<{ className?: string }>> = {
  schematics: FileCode,
  sow: FileText,
  media: Image,
  // Legacy categories for backwards compatibility
  photos: Image,
  videos: Image,
  other: File,
};

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function detectCategory(file: File): FileCategory {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();

  // Photos and Videos go to media
  if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) return 'media';

  // Schematics (CAD, diagrams)
  const schematicExtensions = ['dwg', 'dxf', 'dwf', 'dgn', 'skp', 'step', 'stp', 'iges', 'igs'];
  if (extension && schematicExtensions.includes(extension)) return 'schematics';

  // SOW documents
  const docExtensions = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods'];
  if (extension && docExtensions.includes(extension)) return 'sow';

  return 'other';
}

export function FileUploadDialog({
  open,
  onOpenChange,
  projectId,
  dealId,
  onUpload,
  defaultCategory = 'media',
}: FileUploadDialogProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [globalCategory, setGlobalCategory] = useState<FileCategory>(defaultCategory);
  const [globalNotes, setGlobalNotes] = useState('');
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [initialCameraMode, setInitialCameraMode] = useState<'photo' | 'video'>('photo');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Check camera support on mount
  useEffect(() => {
    setCameraSupported(isGetUserMediaSupported());
  }, []);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;

    const newPendingFiles: PendingFile[] = Array.from(files).map((file) => {
      const category = detectCategory(file);
      let preview: string | undefined;

      // Create preview for images
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }

      return {
        id: crypto.randomUUID(),
        file,
        preview,
        category,
        notes: '',
        status: 'pending',
        progress: 0,
      };
    });

    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle capture from custom camera - always use media category
  const handleCameraCapture = useCallback((file: File, _mode: 'photo' | 'video') => {
    let preview: string | undefined;

    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    const newPendingFile: PendingFile = {
      id: crypto.randomUUID(),
      file,
      preview,
      category: 'media',
      notes: '',
      status: 'pending',
      progress: 0,
    };

    setPendingFiles((prev) => [...prev, newPendingFile]);
    setShowCustomCamera(false);
  }, []);

  const handleOpenPhotoCamera = useCallback(() => {
    setInitialCameraMode('photo');
    setShowCustomCamera(true);
  }, []);

  const handleOpenVideoCamera = useCallback(() => {
    setInitialCameraMode('video');
    setShowCustomCamera(true);
  }, []);

  const removeFile = (id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFileCategory = (id: string, category: FileCategory) => {
    setPendingFiles((prev) =>
      prev.map(f => f.id === id ? { ...f, category } : f)
    );
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    const filesToUpload: FileUploadData[] = pendingFiles.map(pf => ({
      file: pf.file,
      category: pf.category,
      notes: pf.notes || globalNotes,
    }));

    try {
      // Update all files to uploading status
      setPendingFiles((prev) =>
        prev.map(f => ({ ...f, status: 'uploading' as const }))
      );

      await onUpload(filesToUpload);

      // Update all files to success status
      setPendingFiles((prev) =>
        prev.map(f => ({ ...f, status: 'success' as const, progress: 100 }))
      );

      // Close dialog after short delay to show success
      setTimeout(() => {
        onOpenChange(false);
        setPendingFiles([]);
        setGlobalNotes('');
      }, 1000);
    } catch (error) {
      // Update files to error status
      setPendingFiles((prev) =>
        prev.map(f => ({
          ...f,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        }))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Clean up previews
    pendingFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setPendingFiles([]);
    setGlobalNotes('');
    onOpenChange(false);
  };

  return (
    <>
      {/* Custom Camera UI - rendered via portal to escape dialog constraints */}
      {showCustomCamera && typeof document !== 'undefined' && createPortal(
        <CustomCameraUI
          onCapture={handleCameraCapture}
          onClose={() => setShowCustomCamera(false)}
          initialMode={initialCameraMode}
        />,
        document.body
      )}

      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            {projectId
              ? 'Upload files to this project. They will be stored in SharePoint.'
              : dealId
              ? 'Upload presales files linked to this deal.'
              : 'Upload files to the selected location.'}
          </DialogDescription>
        </DialogHeader>

        {/* Offline warning */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
            <CloudOff className="h-5 w-5" />
            <div>
              <p className="font-medium">You&apos;re offline</p>
              <p className="text-sm">Files will be saved locally and uploaded when you reconnect.</p>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center',
            'transition-colors cursor-pointer',
            'hover:border-primary hover:bg-primary/5',
            pendingFiles.length > 0 ? 'border-gray-200' : 'border-gray-300'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-gray-400" />
          <p className="font-medium text-gray-700">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Supports images, videos, documents, and CAD files
          </p>
        </div>

        {/* Quick capture buttons for mobile */}
        {cameraSupported && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleOpenPhotoCamera}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleOpenVideoCamera}
            >
              <Video className="h-4 w-4 mr-2" />
              Record Video
            </Button>
          </div>
        )}

        {/* Hidden file input for browse */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Pending files list */}
        {pendingFiles.length > 0 && (
          <div className="space-y-3">
            <Label>Files to upload ({pendingFiles.length})</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pendingFiles.map((pf) => {
                const Icon = categoryIcons[pf.category];
                return (
                  <div
                    key={pf.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border bg-gray-50',
                      pf.status === 'error' && 'border-red-200 bg-red-50'
                    )}
                  >
                    {/* Preview/Icon */}
                    <div className="flex-shrink-0 h-12 w-12 rounded overflow-hidden bg-white border">
                      {pf.preview ? (
                        <img
                          src={pf.preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Icon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pf.file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(pf.file.size)}</p>
                      {pf.status === 'uploading' && (
                        <Progress value={pf.progress} className="h-1 mt-1" />
                      )}
                      {pf.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{pf.error}</p>
                      )}
                    </div>

                    {/* Category selector */}
                    <Select
                      value={pf.category}
                      onValueChange={(value) => updateFileCategory(pf.id, value as FileCategory)}
                      disabled={isUploading}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FILE_CATEGORY_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status/Remove */}
                    {pf.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(pf.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {pf.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {pf.status === 'success' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {pf.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Global settings */}
        {pendingFiles.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label htmlFor="global-category">Default Category</Label>
              <Select
                value={globalCategory}
                onValueChange={(value) => setGlobalCategory(value as FileCategory)}
              >
                <SelectTrigger id="global-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FILE_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="global-notes">Notes (optional)</Label>
              <Textarea
                id="global-notes"
                value={globalNotes}
                onChange={(e) => setGlobalNotes(e.target.value)}
                placeholder="Add notes about these files..."
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={pendingFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : !isOnline ? (
              <>
                <CloudOff className="h-4 w-4 mr-2" />
                Save Offline
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {pendingFiles.length} {pendingFiles.length === 1 ? 'File' : 'Files'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
