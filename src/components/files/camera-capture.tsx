'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Camera,
  Video,
  SwitchCamera,
  X,
  Check,
  Loader2,
  CloudOff,
  Smartphone,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { compressImage, isImageFile } from '@/lib/image-utils';
import { isGetUserMediaSupported } from '@/lib/video-utils';
import { CustomCameraUI } from './custom-camera-ui';
import type { FileCategory, ProjectPhase, DeviceType } from '@/types';
import { FILE_CATEGORY_CONFIG, PROJECT_PHASE_CONFIG } from '@/types';
import { cn } from '@/lib/utils';

interface CameraCaptureProps {
  projectId?: string;
  dealId?: string;
  onCapture: (data: CapturedFileData) => Promise<void>;
  defaultCategory?: FileCategory;
  defaultPhase?: ProjectPhase;
}

export interface CapturedFileData {
  file: File;
  category: FileCategory;
  phase?: ProjectPhase;
  notes?: string;
  capturedOffline: boolean;
  deviceType: DeviceType;
  location?: { latitude: number; longitude: number };
}

type CaptureMode = 'photo' | 'video';

/**
 * Detect the device type for tracking
 */
function detectDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'Unknown';

  const ua = navigator.userAgent;

  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows|Macintosh|Linux/.test(ua)) return 'Desktop';

  return 'Unknown';
}

/**
 * Floating action button for quick capture on mobile
 */
export function CaptureFloatingButton({
  onClick,
  pendingCount = 0,
}: {
  onClick: () => void;
  pendingCount?: number;
}) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'h-14 w-14 rounded-full shadow-lg',
        'bg-primary text-primary-foreground',
        'flex items-center justify-center',
        'hover:bg-primary/90 active:scale-95 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
      )}
    >
      <Camera className="h-6 w-6" />
      {pendingCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1',
            'h-5 w-5 rounded-full text-xs font-medium',
            'flex items-center justify-center',
            isOnline ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
          )}
        >
          {pendingCount}
        </span>
      )}
    </button>
  );
}

/**
 * Quick capture dialog optimized for iOS Safari
 * Uses native file inputs with capture attribute for best iOS experience
 */
export function CameraCaptureDialog({
  open,
  onOpenChange,
  projectId,
  dealId,
  onCapture,
  defaultCategory = 'photos',
  defaultPhase,
}: CameraCaptureProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<FileCategory>(defaultCategory);
  const [phase, setPhase] = useState<ProjectPhase | undefined>(defaultPhase);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCustomCamera, setShowCustomCamera] = useState(false);
  const [initialCameraMode, setInitialCameraMode] = useState<'photo' | 'video'>('photo');
  const [cameraSupported, setCameraSupported] = useState(false);

  // Check camera support on mount
  useEffect(() => {
    setCameraSupported(isGetUserMediaSupported());
  }, []);

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const deviceType = detectDeviceType();

  // Request location when dialog opens
  const requestLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location not available:', error.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Handle capture from custom camera
  const handleCameraCapture = useCallback((file: File, mode: 'photo' | 'video') => {
    setCapturedFile(file);

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setCapturedPreview(previewUrl);

    // Auto-set category based on capture mode
    if (mode === 'photo') {
      setCategory('photos');
    } else if (mode === 'video') {
      setCategory('videos');
    }

    // Request location
    requestLocation();

    // Close custom camera, show preview
    setShowCustomCamera(false);
  }, [requestLocation]);

  // Open custom camera for photo
  const handleOpenPhotoCamera = useCallback(() => {
    setInitialCameraMode('photo');
    setShowCustomCamera(true);
  }, []);

  // Open custom camera for video
  const handleOpenVideoCamera = useCallback(() => {
    setInitialCameraMode('video');
    setShowCustomCamera(true);
  }, []);

  const handleSubmit = async () => {
    if (!capturedFile) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let fileToUpload = capturedFile;

      // Compress images to reduce storage and upload size
      if (isImageFile(capturedFile)) {
        setIsCompressing(true);
        fileToUpload = await compressImage(capturedFile, {
          maxWidth: 1920,
          maxHeight: 1440,
          quality: 0.8,
        });
        setIsCompressing(false);
      }

      await onCapture({
        file: fileToUpload,
        category,
        phase,
        notes: notes || undefined,
        capturedOffline: !isOnline,
        deviceType,
        location,
      });

      // Reset and close
      handleReset();
      onOpenChange(false);
    } catch (error) {
      console.error('Capture failed:', error);
      setIsCompressing(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to save file. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedFile(null);
    setCapturedPreview(null);
    setNotes('');
    setLocation(undefined);
    setErrorMessage(null);
  };

  const handleClose = () => {
    handleReset();
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Quick Capture
            </DialogTitle>
          </DialogHeader>

          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
              <CloudOff className="h-4 w-4" />
              <span>Offline - will sync when connected</span>
            </div>
          )}

          {/* Device indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Smartphone className="h-4 w-4" />
            <span>Capturing on {deviceType}</span>
          </div>

        {!capturedFile ? (
          /* Capture buttons */
          <div className="space-y-3">
            {/* Camera not supported warning */}
            {!cameraSupported && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Camera Not Available</AlertTitle>
                <AlertDescription className="text-yellow-700 text-sm">
                  Camera access is not supported in this browser.
                  Please use Safari on iOS or a modern desktop browser.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-16 text-lg"
              onClick={handleOpenPhotoCamera}
              disabled={!cameraSupported}
            >
              <Camera className="h-6 w-6 mr-3" />
              Take Photo
            </Button>

            <Button
              variant="outline"
              className="w-full h-16 text-lg"
              onClick={handleOpenVideoCamera}
              disabled={!cameraSupported}
            >
              <Video className="h-6 w-6 mr-3" />
              Record Video
            </Button>

            {/* 720p quality note */}
            <p className="text-xs text-gray-500 text-center">
              Photos and videos are captured at 720p for faster uploads
            </p>
          </div>
        ) : (
          /* Preview and metadata */
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
              {capturedFile.type.startsWith('image/') ? (
                <img
                  src={capturedPreview!}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={capturedPreview!}
                  controls
                  className="w-full h-full object-contain"
                />
              )}

              {/* Retake button */}
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleReset}
              >
                <SwitchCamera className="h-4 w-4 mr-1" />
                Retake
              </Button>
            </div>

            {/* File info */}
            <div className="text-sm text-gray-500">
              <p>{capturedFile.name}</p>
              <p>{(capturedFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>

            {/* Category */}
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FileCategory)}>
                <SelectTrigger>
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

            {/* Phase */}
            <div>
              <Label>Project Phase</Label>
              <Select
                value={phase || ''}
                onValueChange={(v) => setPhase(v as ProjectPhase || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select phase..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_PHASE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this capture..."
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Location indicator */}
            {location && (
              <div className="text-xs text-gray-500">
                Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting || isCompressing}
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compressing...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : !isOnline ? (
                  <>
                    <CloudOff className="h-4 w-4 mr-2" />
                    Save Offline
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * Combined component with floating button and dialog
 */
export function CameraCapture({
  projectId,
  dealId,
  onCapture,
  defaultCategory,
  defaultPhase,
  pendingCount = 0,
}: CameraCaptureProps & { pendingCount?: number }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <CaptureFloatingButton
        onClick={() => setShowDialog(true)}
        pendingCount={pendingCount}
      />

      <CameraCaptureDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        projectId={projectId}
        dealId={dealId}
        onCapture={onCapture}
        defaultCategory={defaultCategory}
        defaultPhase={defaultPhase}
      />
    </>
  );
}
