'use client';

import { useState, useCallback, useTransition } from 'react';
import { toast } from 'sonner';
import { FileBrowser } from '@/components/files/file-browser';
import { CameraCapture, CapturedFileData } from '@/components/files/camera-capture';
import { FileUploadDialog, FileUploadData } from '@/components/files/file-upload-dialog';
import type { ProjectFile, FileCategoryCount, ProjectSharePointConnection } from '@/types';
import {
  uploadFile,
  syncFilesFromSharePoint,
  deleteFile,
  getDownloadUrl,
  createShareLink,
  getProjectFiles,
} from './actions';
import { generateFileThumbnail } from '@/lib/image-utils';

interface ProjectFilesClientProps {
  projectId: string;
  projectName: string;
  initialFiles: ProjectFile[];
  initialCounts: FileCategoryCount[];
  initialConnection: ProjectSharePointConnection | null;
  globalSharePointConfigured: boolean;
}

export function ProjectFilesClient({
  projectId,
  projectName,
  initialFiles,
  initialCounts,
  initialConnection,
  globalSharePointConfigured,
}: ProjectFilesClientProps) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [counts, setCounts] = useState<FileCategoryCount[]>(initialCounts);
  const [connection, setConnection] = useState<ProjectSharePointConnection | null>(initialConnection);
  const [isPending, startTransition] = useTransition();
  const [showFabUploadDialog, setShowFabUploadDialog] = useState(false);

  // Get pending upload count for floating button badge
  const pendingCount = files.filter(f => f.upload_status !== 'uploaded').length;

  // Refresh files from server
  const refreshFiles = useCallback(async () => {
    const result = await getProjectFiles(projectId);
    if (result.success) {
      setFiles(result.files || []);
      setCounts(result.counts || []);
      setConnection(result.connection || null);
    }
  }, [projectId]);

  // Upload thumbnail for a file
  const uploadThumbnail = useCallback(async (file: File, fileId: string): Promise<string | null> => {
    try {
      const thumbnailBlob = await generateFileThumbnail(file, 320);
      if (!thumbnailBlob) return null;

      const formData = new FormData();
      formData.append('thumbnail', new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' }));
      formData.append('fileId', fileId);
      formData.append('fileType', 'project');

      const response = await fetch('/api/thumbnails', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.url || null;
    } catch (error) {
      console.error('Thumbnail upload failed:', error);
      return null;
    }
  }, []);

  // Handle file upload
  const handleUpload = useCallback(async (uploadData: FileUploadData[]) => {
    for (const data of uploadData) {
      try {
        console.log('[Upload] Starting upload:', {
          name: data.file.name,
          size: data.file.size,
          type: data.file.type,
          category: data.category,
        });

        const arrayBuffer = await data.file.arrayBuffer();
        console.log('[Upload] ArrayBuffer size:', arrayBuffer.byteLength);

        const result = await uploadFile({
          projectId,
          fileName: data.file.name,
          fileContent: arrayBuffer,
          contentType: data.file.type,
          category: data.category,
          notes: data.notes,
        });

        console.log('[Upload] Result:', result);

        if (result.success && result.file) {
          // Generate and upload thumbnail in background
          const thumbnailUrl = await uploadThumbnail(data.file, result.file.id);

          // Update file in state with thumbnail
          const fileWithThumb = thumbnailUrl
            ? { ...result.file, local_thumbnail_url: thumbnailUrl }
            : result.file;

          setFiles(prev => [fileWithThumb, ...prev]);
          // Update counts
          setCounts(prev => {
            const existing = prev.find(c => c.category === data.category);
            if (existing) {
              return prev.map(c =>
                c.category === data.category
                  ? { ...c, count: c.count + 1 }
                  : c
              );
            }
            return [...prev, { category: data.category, count: 1 }];
          });
          toast.success(`Uploaded ${data.file.name}`);
        } else {
          toast.error(result.error || `Failed to upload ${data.file.name}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${data.file.name}`);
      }
    }
  }, [projectId, uploadThumbnail]);

  // Handle camera capture
  // Note: Don't use startTransition here - it causes Next.js to re-render server components
  const handleCapture = useCallback(async (data: CapturedFileData) => {
    console.log('[handleCapture] Starting capture upload:', {
      name: data.file.name,
      size: data.file.size,
      type: data.file.type,
      category: data.category,
    });

    try {
      console.log('[handleCapture] Converting to ArrayBuffer...');
      const arrayBuffer = await data.file.arrayBuffer();
      console.log('[handleCapture] ArrayBuffer size:', arrayBuffer.byteLength);

      console.log('[handleCapture] Calling uploadFile...');
      const result = await uploadFile({
        projectId,
        fileName: data.file.name,
        fileContent: arrayBuffer,
        contentType: data.file.type,
        category: data.category,
        notes: data.notes,
        capturedOffline: data.capturedOffline,
        capturedOnDevice: data.deviceType,
      });

      console.log('[handleCapture] Upload result:', {
        success: result.success,
        error: result.error,
        fileId: result.file?.id,
      });

      if (result.success && result.file) {
        // Generate and upload thumbnail in background (don't await)
        uploadThumbnail(data.file, result.file.id).then(thumbnailUrl => {
          if (thumbnailUrl) {
            setFiles(prev => prev.map(f =>
              f.id === result.file!.id
                ? { ...f, local_thumbnail_url: thumbnailUrl }
                : f
            ));
          }
        }).catch(err => console.error('Thumbnail upload failed:', err));

        // Update state immediately with the new file
        setFiles(prev => [result.file!, ...prev]);
        setCounts(prev => {
          const existing = prev.find(c => c.category === data.category);
          if (existing) {
            return prev.map(c =>
              c.category === data.category
                ? { ...c, count: c.count + 1 }
                : c
            );
          }
          return [...prev, { category: data.category, count: 1 }];
        });
        toast.success(data.file.type.startsWith('video/') ? 'Video saved' : 'Photo saved');
      } else {
        console.error('[handleCapture] Upload failed:', result.error);
        toast.error(result.error || 'Failed to save file');
      }
    } catch (error) {
      console.error('[handleCapture] Unexpected error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[handleCapture] Error details:', errorMessage);
      toast.error(`Upload failed: ${errorMessage}`);
    }
  }, [projectId, uploadThumbnail]);

  // Handle sync from SharePoint
  const handleSync = useCallback(async () => {
    startTransition(async () => {
      const result = await syncFilesFromSharePoint(projectId);

      if (result.success) {
        toast.success(`Synced ${result.syncedCount || 0} files from SharePoint`);
        await refreshFiles();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    });
  }, [projectId, refreshFiles]);

  // Handle file download
  const handleDownload = useCallback(async (file: ProjectFile) => {
    const result = await getDownloadUrl(file.id);

    if (result.success && result.url) {
      // Open download URL in new tab
      window.open(result.url, '_blank');
    } else {
      toast.error(result.error || 'Failed to get download link');
    }
  }, []);

  // Handle file delete
  const handleDelete = useCallback(async (file: ProjectFile) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteFile(file.id);

      if (result.success) {
        setFiles(prev => prev.filter(f => f.id !== file.id));
        setCounts(prev =>
          prev.map(c =>
            c.category === file.category
              ? { ...c, count: Math.max(0, c.count - 1) }
              : c
          ).filter(c => c.count > 0)
        );
        toast.success('File deleted');
      } else {
        toast.error(result.error || 'Failed to delete file');
      }
    });
  }, []);

  // Handle file share
  const handleShare = useCallback(async (file: ProjectFile) => {
    const result = await createShareLink(file.id);

    if (result.success && result.url) {
      await navigator.clipboard.writeText(result.url);
      toast.success('Share link copied to clipboard');
    } else {
      toast.error(result.error || 'Failed to create share link');
    }
  }, []);

  // Handle file preview
  const handlePreview = useCallback((file: ProjectFile) => {
    if (file.web_url) {
      window.open(file.web_url, '_blank');
    } else {
      toast.error('Preview not available');
    }
  }, []);

  return (
    <>
      <FileBrowser
        projectId={projectId}
        projectName={projectName}
        files={files}
        counts={counts}
        connection={connection}
        globalSharePointConfigured={globalSharePointConfigured}
        isLoading={isPending}
        onUpload={handleUpload}
        onSync={handleSync}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onShare={handleShare}
        onPreview={handlePreview}
      />

      {/* Floating action button for capture/upload (mobile) */}
      <CameraCapture
        projectId={projectId}
        onCapture={handleCapture}
        onUpload={() => setShowFabUploadDialog(true)}
        defaultCategory="media"
        pendingCount={pendingCount}
      />

      {/* Upload dialog triggered from FAB */}
      <FileUploadDialog
        open={showFabUploadDialog}
        onOpenChange={setShowFabUploadDialog}
        projectId={projectId}
        onUpload={handleUpload}
      />
    </>
  );
}
