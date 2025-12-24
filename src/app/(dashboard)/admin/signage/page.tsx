'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Play, Square, RefreshCw, Monitor, AlertTriangle, Clock, Tv, Activity } from 'lucide-react';
import {
  getSignageStatus,
  getSignageConfig,
  startSignageEngine,
  stopSignageEngine,
  restartSignageEngine,
  getSignageLogs,
  updateSignageConfig,
  type SignageStatus,
  type SignageConfig,
  type LogEntry,
} from './actions';

const SIGNAGE_PREVIEW_URL = 'http://127.0.0.1:3001/preview';

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export default function SignageAdminPage() {
  const [status, setStatus] = useState<SignageStatus | null>(null);
  const [config, setConfig] = useState<SignageConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [connectionError, setConnectionError] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [statusData, configData, logsData] = await Promise.all([
        getSignageStatus(),
        getSignageConfig(),
        getSignageLogs(),
      ]);

      if (statusData) {
        setStatus(statusData);
        setConnectionError(false);
      } else {
        setConnectionError(true);
      }

      if (configData) setConfig(configData);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setConnectionError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleStart = async () => {
    setActionLoading('start');
    const result = await startSignageEngine();
    if (!result.success) {
      console.error('Failed to start:', result.error);
    }
    await refreshData();
    setActionLoading(null);
  };

  const handleStop = async () => {
    setActionLoading('stop');
    const result = await stopSignageEngine();
    if (!result.success) {
      console.error('Failed to stop:', result.error);
    }
    await refreshData();
    setActionLoading(null);
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    const result = await restartSignageEngine();
    if (!result.success) {
      console.error('Failed to restart:', result.error);
    }
    await refreshData();
    setActionLoading(null);
  };

  const handleToggleSlide = async (index: number) => {
    if (!config) return;
    const updatedSlides = [...config.slides];
    updatedSlides[index] = { ...updatedSlides[index], enabled: !updatedSlides[index].enabled };
    const result = await updateSignageConfig({ slides: updatedSlides });
    if (result) setConfig(result);
  };

  const handleSlideDurationChange = async (index: number, duration: number) => {
    if (!config) return;
    const updatedSlides = [...config.slides];
    updatedSlides[index] = { ...updatedSlides[index], duration };
    const result = await updateSignageConfig({ slides: updatedSlides });
    if (result) setConfig(result);
  };

  const refreshPreview = () => {
    setPreviewKey((k) => k + 1);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Digital Signage</h1>
          <p className="text-muted-foreground">Control and monitor the NDI digital signage engine</p>
        </div>
        <div className="flex items-center gap-2">
          {connectionError ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Engine Offline
            </Badge>
          ) : status?.isRunning ? (
            <Badge variant="default" className="bg-green-600 gap-1">
              <Activity className="h-3 w-3" />
              Running
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Square className="h-3 w-3" />
              Stopped
            </Badge>
          )}
        </div>
      </div>

      {connectionError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-medium">Signage Engine Not Connected</p>
              <p className="text-sm text-muted-foreground">
                The signage engine is not responding. Make sure it&apos;s running at{' '}
                <code className="bg-muted px-1 rounded">http://127.0.0.1:3001</code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {status?.isRunning ? formatUptime(status.uptime) : '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frame Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {status?.isRunning ? `${status.fps.toFixed(1)} fps` : '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Slide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {status?.isRunning ? `${status.currentSlide + 1} / ${status.totalSlides}` : '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frames Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {status?.isRunning ? status.frameCount.toLocaleString() : '--'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleStart}
          disabled={status?.isRunning || actionLoading !== null || connectionError}
          className="gap-2"
        >
          {actionLoading === 'start' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start
        </Button>
        <Button
          onClick={handleStop}
          disabled={!status?.isRunning || actionLoading !== null || connectionError}
          variant="secondary"
          className="gap-2"
        >
          {actionLoading === 'stop' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          Stop
        </Button>
        <Button
          onClick={handleRestart}
          disabled={actionLoading !== null || connectionError}
          variant="outline"
          className="gap-2"
        >
          {actionLoading === 'restart' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Restart
        </Button>
      </div>

      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="slides">Slides</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live Preview</CardTitle>
                  <CardDescription>Current frame being sent via NDI</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={refreshPreview} disabled={!status?.isRunning}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {status?.isRunning ? (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <img
                    key={previewKey}
                    src={`${SIGNAGE_PREVIEW_URL}?t=${previewKey}`}
                    alt="Signage Preview"
                    className="w-full h-full object-contain"
                  />
                  {status.dataStale && (
                    <div className="absolute bottom-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded text-sm font-medium">
                      Data may be stale
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Engine not running</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slide Configuration</CardTitle>
              <CardDescription>Enable/disable slides and adjust their duration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config?.slides.map((slide, index) => (
                <div key={index} className="flex items-center justify-between gap-4 pb-4 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={slide.enabled}
                      onCheckedChange={() => handleToggleSlide(index)}
                      id={`slide-${index}`}
                    />
                    <div>
                      <Label htmlFor={`slide-${index}`} className="font-medium">
                        {slide.title || slide.type}
                      </Label>
                      <p className="text-sm text-muted-foreground">{slide.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-64">
                    <Label className="text-sm whitespace-nowrap">{(slide.duration / 1000).toFixed(0)}s</Label>
                    <Slider
                      value={[slide.duration]}
                      min={5000}
                      max={60000}
                      step={1000}
                      onValueChange={(value) => handleSlideDurationChange(index, value[0])}
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Latest log entries from the signage engine</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-y-auto font-mono text-sm bg-muted rounded-lg p-4 space-y-1">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs available</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-muted-foreground">{formatTime(log.time)}</span>
                      <Badge
                        variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {log.level}
                      </Badge>
                      <span>{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
