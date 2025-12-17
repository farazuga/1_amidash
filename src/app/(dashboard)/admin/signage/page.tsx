'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tv,
  Activity,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  Settings,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSignageStatus,
  startSignageEngine,
  stopSignageEngine,
  restartSignageEngine,
  nextSlide,
  previousSlide,
  getSignageConfig,
  updateSignageConfig,
  getSignageLogs,
  getPreviewUrl,
  isEngineReachable,
  type EngineStatus,
  type SignageConfig,
  type SlideConfig,
  type LogEntry,
} from './actions';

const SLIDE_TYPE_LABELS: Record<string, string> = {
  'active-projects': 'Active Projects',
  'po-ticker': 'PO Ticker',
  'revenue-dashboard': 'Revenue Dashboard',
  'team-schedule': 'Team Schedule',
};

export default function SignageAdminPage() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [config, setConfig] = useState<SignageConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [previewKey, setPreviewKey] = useState(0);
  const [isReachable, setIsReachable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Fetch status periodically
  const fetchStatus = useCallback(async () => {
    const reachable = await isEngineReachable();
    setIsReachable(reachable);

    if (reachable) {
      const [statusData, configData, logsData] = await Promise.all([
        getSignageStatus(),
        getSignageConfig(),
        getSignageLogs(20),
      ]);

      setStatus(statusData);
      setConfig(configData);
      setLogs(logsData);
    } else {
      setStatus(null);
      setConfig(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Refresh preview image
  useEffect(() => {
    if (status?.running) {
      const interval = setInterval(() => {
        setPreviewKey((k) => k + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status?.running]);

  // Action handlers
  const handleStart = () => {
    startTransition(async () => {
      const result = await startSignageEngine();
      if (result.success) {
        toast.success('Signage engine started');
        fetchStatus();
      } else {
        toast.error(result.error || 'Failed to start engine');
      }
    });
  };

  const handleStop = () => {
    startTransition(async () => {
      const result = await stopSignageEngine();
      if (result.success) {
        toast.success('Signage engine stopped');
        fetchStatus();
      } else {
        toast.error(result.error || 'Failed to stop engine');
      }
    });
  };

  const handleRestart = () => {
    startTransition(async () => {
      const result = await restartSignageEngine();
      if (result.success) {
        toast.success('Signage engine restarted');
        fetchStatus();
      } else {
        toast.error(result.error || 'Failed to restart engine');
      }
    });
  };

  const handleNextSlide = () => {
    startTransition(async () => {
      await nextSlide();
      fetchStatus();
    });
  };

  const handlePrevSlide = () => {
    startTransition(async () => {
      await previousSlide();
      fetchStatus();
    });
  };

  const handleSlideToggle = (index: number, enabled: boolean) => {
    if (!config) return;

    startTransition(async () => {
      const newSlides = [...config.slides];
      newSlides[index] = { ...newSlides[index], enabled };

      const result = await updateSignageConfig({ slides: newSlides });
      if (result.success) {
        toast.success(`Slide ${enabled ? 'enabled' : 'disabled'}`);
        fetchStatus();
      } else {
        toast.error('Failed to update slide');
      }
    });
  };

  const handleDurationChange = (index: number, duration: number) => {
    if (!config) return;

    startTransition(async () => {
      const newSlides = [...config.slides];
      newSlides[index] = { ...newSlides[index], duration: duration * 1000 };

      const result = await updateSignageConfig({ slides: newSlides });
      if (result.success) {
        fetchStatus();
      }
    });
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatDataAge = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';
    const age = Date.now() - timestamp;
    const seconds = Math.floor(age / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Digital Signage</h1>
        <p className="text-muted-foreground">Control your NDI signage output</p>
      </div>

      {/* Connection Warning */}
      {!isReachable && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Engine Not Reachable</AlertTitle>
          <AlertDescription>
            Cannot connect to the signage engine. Make sure it&apos;s running with{' '}
            <code className="bg-muted px-1 rounded">cd signage-engine && npm run dev</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Status and Controls Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Engine Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5" />
              Engine Status
            </CardTitle>
            <CardDescription>Current signage engine status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              {status?.running ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Running
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Stopped
                </Badge>
              )}
            </div>

            {/* Stats */}
            {status && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">NDI Output</span>
                  <span className="font-medium">{status.ndiName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Resolution</span>
                  <span className="font-medium">
                    {status.resolution.width} x {status.resolution.height}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frame Rate</span>
                  <span className="font-medium">
                    {status.actualFps} / {status.frameRate} fps
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium">{formatUptime(status.uptime)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Data Updated</span>
                  <span className="font-medium">{formatDataAge(status.lastDataUpdate)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Controls Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Controls
            </CardTitle>
            <CardDescription>Start, stop, and control the signage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Main Controls */}
            <div className="flex gap-2">
              {status?.running ? (
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  disabled={isPending || !isReachable}
                  className="flex-1"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  Stop
                </Button>
              ) : (
                <Button onClick={handleStart} disabled={isPending || !isReachable} className="flex-1">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Start
                </Button>
              )}
              <Button variant="outline" onClick={handleRestart} disabled={isPending || !isReachable}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Slide Navigation */}
            {status?.running && status.totalSlides > 1 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Slide {status.currentSlide + 1} of {status.totalSlides}
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevSlide} disabled={isPending}>
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNextSlide} disabled={isPending}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Preview, Slides, and Logs */}
      <Tabs defaultValue="preview" className="w-full">
        <TabsList>
          <TabsTrigger value="preview">
            <Monitor className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="slides">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Slides
          </TabsTrigger>
          <TabsTrigger value="logs">
            <ScrollText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>Preview of the current signage output (scaled down)</CardDescription>
            </CardHeader>
            <CardContent>
              {status?.running && isReachable ? (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={previewKey}
                    src={`${getPreviewUrl()}?t=${previewKey}`}
                    alt="Signage Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Monitor className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{isReachable ? 'Engine not running' : 'Engine not reachable'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slides Tab */}
        <TabsContent value="slides">
          <Card>
            <CardHeader>
              <CardTitle>Slide Configuration</CardTitle>
              <CardDescription>Enable, disable, and configure individual slides</CardDescription>
            </CardHeader>
            <CardContent>
              {config?.slides ? (
                <div className="space-y-4">
                  {config.slides.map((slide, index) => (
                    <div
                      key={`${slide.type}-${index}`}
                      className={`p-4 rounded-lg border ${
                        slide.enabled ? 'bg-background' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={slide.enabled}
                            onCheckedChange={(checked) => handleSlideToggle(index, checked)}
                            disabled={isPending || !isReachable}
                          />
                          <div>
                            <Label className="text-base font-medium">
                              {SLIDE_TYPE_LABELS[slide.type] || slide.type}
                            </Label>
                            {slide.title && (
                              <p className="text-sm text-muted-foreground">{slide.title}</p>
                            )}
                          </div>
                        </div>
                        {status?.running && status.currentSlide === index && (
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                        )}
                      </div>

                      {slide.enabled && (
                        <div className="pl-10 space-y-3">
                          <div className="flex items-center gap-4">
                            <Label className="w-24 text-sm text-muted-foreground">Duration</Label>
                            <Slider
                              value={[slide.duration / 1000]}
                              onValueChange={(value) => handleDurationChange(index, value[0])}
                              min={5}
                              max={60}
                              step={5}
                              className="flex-1"
                              disabled={isPending || !isReachable}
                            />
                            <span className="w-16 text-sm text-right">{slide.duration / 1000}s</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{isReachable ? 'Loading configuration...' : 'Engine not reachable'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Last 20 log entries from the signage engine</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length > 0 ? (
                <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        log.level === 'error'
                          ? 'bg-red-500/10 text-red-500'
                          : log.level === 'warn'
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : 'bg-muted'
                      }`}
                    >
                      <span className="text-muted-foreground">
                        {new Date(log.time).toLocaleTimeString()}
                      </span>{' '}
                      <span className="font-semibold">[{log.level}]</span> {log.msg}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ScrollText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{isReachable ? 'No logs available' : 'Engine not reachable'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
