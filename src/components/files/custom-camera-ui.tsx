'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Video,
  X,
  SwitchCamera,
  Loader2,
  Circle,
  Square,
  Check,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { useCameraStream } from '@/hooks/use-camera-stream';
import {
  capturePhotoFromStream,
  createVideoRecorder,
  stopRecordingAndGetBlob,
  createFileFromBlob,
  formatDuration,
  getErrorMessage,
  isMediaRecorderSupported,
  type CameraError,
} from '@/lib/video-utils';
import { cn } from '@/lib/utils';

type CaptureMode = 'photo' | 'video';
type CameraState = 'idle' | 'streaming' | 'recording' | 'preview';

interface CustomCameraUIProps {
  onCapture: (file: File, mode: CaptureMode) => void;
  onClose: () => void;
  initialMode?: CaptureMode;
}

/**
 * Full-screen custom camera UI with live preview
 * Optimized for iOS Safari with 720p capture
 */
export function CustomCameraUI({
  onCapture,
  onClose,
  initialMode = 'photo',
}: CustomCameraUIProps) {
  // Camera stream
  const {
    stream,
    isLoading,
    isStreaming,
    error,
    capabilities,
    currentFacingMode,
    startStream,
    stopStream,
    switchCamera,
    videoRef,
  } = useCameraStream();

  // Local state
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Start camera when component mounts
  useEffect(() => {
    startStream();

    return () => {
      stopStream();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Update camera state based on stream
  useEffect(() => {
    if (isStreaming && cameraState === 'idle') {
      setCameraState('streaming');
    }
  }, [isStreaming, cameraState]);

  // Handle photo capture
  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    setCaptureError(null);

    try {
      const blob = await capturePhotoFromStream(videoRef.current);
      setCapturedBlob(blob);

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCameraState('preview');
    } catch (err) {
      console.error('Photo capture failed:', err);
      setCaptureError('Failed to capture photo. Please try again.');
    }
  }, [videoRef]);

  // Handle video recording start
  const handleStartRecording = useCallback(async () => {
    console.log('[CustomCamera] handleStartRecording called');
    console.log('[CustomCamera] stream:', stream ? 'exists' : 'null');
    console.log('[CustomCamera] isMediaRecorderSupported:', isMediaRecorderSupported());

    if (!stream || !isMediaRecorderSupported()) {
      console.error('[CustomCamera] Recording not supported or no stream');
      setCaptureError('Video recording is not supported on this device.');
      return;
    }

    setCaptureError(null);

    try {
      console.log('[CustomCamera] Creating video recorder...');
      const recorder = createVideoRecorder(stream);
      console.log('[CustomCamera] Recorder created:', recorder);
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setCameraState('recording');
      setRecordingDuration(0);
      console.log('[CustomCamera] Recording state set');

      // Start duration timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      recorder.start();
      console.log('[CustomCamera] Recorder started');
    } catch (err) {
      console.error('[CustomCamera] Failed to start recording:', err);
      setCaptureError('Failed to start video recording. Please try again.');
    }
  }, [stream]);

  // Handle video recording stop
  const handleStopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    try {
      const blob = await stopRecordingAndGetBlob(mediaRecorderRef.current);
      setCapturedBlob(blob);

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      setIsRecording(false);
      setCameraState('preview');

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setCaptureError('Failed to save video. Please try again.');
      setIsRecording(false);
      setCameraState('streaming');

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, []);

  // Handle retake
  const handleRetake = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setRecordingDuration(0);
    setCameraState('streaming');
    setCaptureError(null);
  }, [previewUrl]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (!capturedBlob) {
      console.error('[Camera] No captured blob to confirm');
      setCaptureError('No captured content to save');
      return;
    }

    try {
      console.log('[Camera] Creating file from blob:', {
        blobSize: capturedBlob.size,
        blobType: capturedBlob.type,
        mode,
      });

      const file = createFileFromBlob(capturedBlob, undefined, mode);

      console.log('[Camera] File created:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      onCapture(file, mode);
    } catch (error) {
      console.error('[Camera] Error creating file:', error);
      setCaptureError('Failed to process captured content');
    }
  }, [capturedBlob, mode, onCapture]);

  // Handle mode switch
  const handleModeSwitch = useCallback((newMode: CaptureMode) => {
    console.log('[CustomCamera] handleModeSwitch to:', newMode, 'isRecording:', isRecording);
    if (isRecording) return;
    setMode(newMode);
    setCaptureError(null);
  }, [isRecording]);

  // Handle close
  const handleClose = useCallback(() => {
    stopStream();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    onClose();
  }, [onClose, previewUrl, stopStream]);

  // Debug log render state
  console.log('[CustomCamera] Render state:', {
    mode,
    cameraState,
    isStreaming,
    isLoading,
    isRecording,
    hasStream: !!stream,
  });

  // Render error state
  if (error && !isStreaming) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Camera Error
          </h2>
          <p className="text-gray-600 mb-4">{getErrorMessage(error)}</p>

          {error === 'permission_denied' && (
            <p className="text-sm text-gray-500 mb-4">
              To enable camera access on iOS:
              <br />
              Settings → Safari → Camera → Allow
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => startStream()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
        </Button>

        {capabilities.canSwitchCamera && cameraState === 'streaming' && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={switchCamera}
            disabled={isLoading}
          >
            <SwitchCamera className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Video Preview Area */}
      <div className="flex-1 flex items-center justify-center">
        {cameraState === 'preview' && previewUrl ? (
          // Show captured preview
          mode === 'photo' ? (
            <img
              src={previewUrl}
              alt="Captured photo"
              className={cn(
                'max-w-full max-h-full object-contain',
                currentFacingMode === 'user' && 'scale-x-[-1]'
              )}
            />
          ) : (
            <video
              ref={previewVideoRef}
              src={previewUrl}
              controls
              className={cn(
                'max-w-full max-h-full object-contain',
                currentFacingMode === 'user' && 'scale-x-[-1]'
              )}
              playsInline
              autoPlay
              muted
            />
          )
        ) : (
          // Show live camera feed
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'max-w-full max-h-full object-contain',
                currentFacingMode === 'user' && 'scale-x-[-1]'
              )}
            />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-red-600 rounded-full">
          <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
          <span className="text-white font-mono text-lg">
            {formatDuration(recordingDuration)}
          </span>
        </div>
      )}

      {/* Error message */}
      {captureError && (
        <div className="absolute bottom-32 left-4 right-4 bg-red-600 text-white text-center py-2 px-4 rounded-lg">
          {captureError}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pb-8">
        {cameraState === 'preview' ? (
          // Preview controls
          <div className="flex items-center justify-center gap-8">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/20 flex flex-col items-center gap-1"
              onClick={handleRetake}
            >
              <RotateCcw className="h-8 w-8" />
              <span className="text-sm">Retake</span>
            </Button>

            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
              onClick={handleConfirm}
            >
              <Check className="h-8 w-8" />
            </Button>
          </div>
        ) : (
          // Capture controls
          <div className="flex items-center justify-between">
            {/* Photo mode button */}
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                'text-white hover:bg-white/20 flex flex-col items-center gap-1',
                mode === 'photo' && 'bg-white/20'
              )}
              onClick={() => handleModeSwitch('photo')}
              disabled={isRecording}
            >
              <Camera className="h-6 w-6" />
              <span className="text-xs">Photo</span>
            </Button>

            {/* Main capture button */}
            <div className="flex flex-col items-center">
              {mode === 'photo' ? (
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full bg-white hover:bg-gray-200"
                  onClick={handleCapturePhoto}
                  disabled={!isStreaming || isLoading}
                >
                  <Circle className="h-16 w-16 text-gray-800" />
                </Button>
              ) : isRecording ? (
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full bg-red-600 hover:bg-red-700"
                  onClick={handleStopRecording}
                >
                  <Square className="h-8 w-8 text-white" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-20 w-20 rounded-full bg-red-600 hover:bg-red-700"
                  onClick={handleStartRecording}
                  disabled={!isStreaming || isLoading}
                >
                  <Circle className="h-16 w-16 text-white fill-current" />
                </Button>
              )}
            </div>

            {/* Video mode button */}
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                'text-white hover:bg-white/20 flex flex-col items-center gap-1',
                mode === 'video' && 'bg-white/20'
              )}
              onClick={() => handleModeSwitch('video')}
              disabled={isRecording}
            >
              <Video className="h-6 w-6" />
              <span className="text-xs">Video</span>
            </Button>
          </div>
        )}
      </div>

      {/* Safe area padding for iOS */}
      <div className="h-safe-area-inset-bottom" />
    </div>
  );
}
