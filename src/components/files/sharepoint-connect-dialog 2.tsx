'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderSync,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SharePointConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onConnect: (connection: SharePointFolderSelection) => Promise<void>;
  isConnected?: boolean;
}

export interface SharePointFolderSelection {
  siteId: string;
  siteName: string;
  driveId: string;
  driveName: string;
  folderId: string;
  folderPath: string;
  folderUrl: string;
}

interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

interface SharePointDrive {
  id: string;
  name: string;
  webUrl: string;
}

interface SharePointFolder {
  id: string;
  name: string;
  webUrl: string;
  childCount?: number;
  path?: string;
}

type ConnectionStep = 'sites' | 'drives' | 'folders' | 'confirm';

export function SharePointConnectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onConnect,
  isConnected,
}: SharePointConnectDialogProps) {
  const [step, setStep] = useState<ConnectionStep>('sites');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<SharePointSite | null>(null);

  const [drives, setDrives] = useState<SharePointDrive[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<SharePointDrive | null>(null);

  const [folders, setFolders] = useState<SharePointFolder[]>([]);
  const [folderPath, setFolderPath] = useState<SharePointFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<SharePointFolder | null>(null);

  const [createNewFolder, setCreateNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState(projectName);

  const [isConnecting, setIsConnecting] = useState(false);

  // Load sites on mount
  useEffect(() => {
    if (open && step === 'sites') {
      loadSites();
    }
  }, [open, step]);

  const loadSites = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sharepoint/sites');
      if (!response.ok) throw new Error('Failed to load sites');
      const data = await response.json();
      setSites(data.sites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SharePoint sites');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDrives = async (siteId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sharepoint/sites/${siteId}/drives`);
      if (!response.ok) throw new Error('Failed to load drives');
      const data = await response.json();
      setDrives(data.drives || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document libraries');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async (driveId: string, folderId: string = 'root') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sharepoint/drives/${driveId}/folders/${folderId}`);
      if (!response.ok) throw new Error('Failed to load folders');
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSite = (site: SharePointSite) => {
    setSelectedSite(site);
    loadDrives(site.id);
    setStep('drives');
  };

  const handleSelectDrive = (drive: SharePointDrive) => {
    setSelectedDrive(drive);
    loadFolders(drive.id);
    setFolderPath([{ id: 'root', name: 'Root', webUrl: drive.webUrl }]);
    setStep('folders');
  };

  const handleSelectFolder = (folder: SharePointFolder) => {
    if (folder.childCount && folder.childCount > 0) {
      // Navigate into folder
      setFolderPath([...folderPath, folder]);
      loadFolders(selectedDrive!.id, folder.id);
    }
    setSelectedFolder(folder);
  };

  const handleNavigateBack = () => {
    if (folderPath.length > 1) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      const parentFolder = newPath[newPath.length - 1];
      loadFolders(selectedDrive!.id, parentFolder.id);
    }
  };

  const handleConfirm = () => {
    setStep('confirm');
  };

  const handleConnect = async () => {
    if (!selectedSite || !selectedDrive) return;

    setIsConnecting(true);
    setError(null);

    try {
      const currentFolder = selectedFolder || folderPath[folderPath.length - 1];
      const folderPathString = folderPath.map(f => f.name).join('/') +
        (selectedFolder && selectedFolder.id !== 'root' ? `/${selectedFolder.name}` : '');

      await onConnect({
        siteId: selectedSite.id,
        siteName: selectedSite.displayName || selectedSite.name,
        driveId: selectedDrive.id,
        driveName: selectedDrive.name,
        folderId: createNewFolder ? 'new' : currentFolder.id,
        folderPath: createNewFolder ? `${folderPathString}/${newFolderName}` : folderPathString,
        folderUrl: currentFolder.webUrl,
      });

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'drives':
        setStep('sites');
        setSelectedSite(null);
        break;
      case 'folders':
        setStep('drives');
        setSelectedDrive(null);
        setFolderPath([]);
        break;
      case 'confirm':
        setStep('folders');
        break;
    }
  };

  const resetState = () => {
    setStep('sites');
    setSelectedSite(null);
    setSelectedDrive(null);
    setSelectedFolder(null);
    setFolderPath([]);
    setCreateNewFolder(false);
    setNewFolderName(projectName);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetState();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderSync className="h-5 w-5" />
            Connect SharePoint Folder
          </DialogTitle>
          <DialogDescription>
            {step === 'sites' && 'Select a SharePoint site to store project files'}
            {step === 'drives' && 'Select a document library'}
            {step === 'folders' && 'Navigate to the folder for this project'}
            {step === 'confirm' && 'Review and confirm your selection'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-sm">
          {['sites', 'drives', 'folders', 'confirm'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium',
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : i < ['sites', 'drives', 'folders', 'confirm'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                {i < ['sites', 'drives', 'folders', 'confirm'].indexOf(step) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />}
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {/* Sites list */}
          {step === 'sites' && (
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))
              ) : sites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No SharePoint sites found</p>
                </div>
              ) : (
                sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => handleSelectSite(site)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border',
                      'hover:bg-gray-50 transition-colors text-left'
                    )}
                  >
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{site.displayName || site.name}</p>
                      <p className="text-sm text-gray-500 truncate">{site.webUrl}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Drives list */}
          {step === 'drives' && (
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))
              ) : drives.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Folder className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No document libraries found</p>
                </div>
              ) : (
                drives.map((drive) => (
                  <button
                    key={drive.id}
                    onClick={() => handleSelectDrive(drive)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border',
                      'hover:bg-gray-50 transition-colors text-left'
                    )}
                  >
                    <Folder className="h-8 w-8 text-yellow-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{drive.name}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Folders browser */}
          {step === 'folders' && (
            <div className="space-y-3">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm overflow-x-auto">
                {folderPath.map((folder, i) => (
                  <div key={folder.id} className="flex items-center">
                    {i > 0 && <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />}
                    <button
                      onClick={() => {
                        setFolderPath(folderPath.slice(0, i + 1));
                        loadFolders(selectedDrive!.id, folder.id);
                      }}
                      className="text-primary hover:underline whitespace-nowrap"
                    >
                      {folder.name}
                    </button>
                  </div>
                ))}
              </div>

              {/* Back button */}
              {folderPath.length > 1 && (
                <Button variant="ghost" size="sm" onClick={handleNavigateBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              {/* Folders */}
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : (
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleSelectFolder(folder)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg',
                        'hover:bg-gray-100 transition-colors text-left',
                        selectedFolder?.id === folder.id && 'bg-primary/10 border-primary'
                      )}
                    >
                      {folder.childCount && folder.childCount > 0 ? (
                        <FolderOpen className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <Folder className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="flex-1 truncate">{folder.name}</span>
                      {folder.childCount !== undefined && folder.childCount > 0 && (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  ))}

                  {folders.length === 0 && (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No subfolders. You can use this folder or create a new one.
                    </p>
                  )}
                </div>
              )}

              {/* Create new folder option */}
              <div className="pt-3 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createNewFolder}
                    onChange={(e) => setCreateNewFolder(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Create new folder for this project</span>
                </label>
                {createNewFolder && (
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          )}

          {/* Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-50 space-y-3">
                <div>
                  <Label className="text-gray-500">Site</Label>
                  <p className="font-medium">{selectedSite?.displayName || selectedSite?.name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Document Library</Label>
                  <p className="font-medium">{selectedDrive?.name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Folder</Label>
                  <p className="font-medium">
                    {folderPath.map(f => f.name).join(' / ')}
                    {selectedFolder && selectedFolder.id !== 'root' && ` / ${selectedFolder.name}`}
                    {createNewFolder && ` / ${newFolderName}`}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1">
                  {createNewFolder && <li>A new folder &quot;{newFolderName}&quot; will be created</li>}
                  <li>Category subfolders (Schematics, SOW, Photos, Videos) will be created</li>
                  <li>Files uploaded to this project will sync to SharePoint</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {step !== 'sites' && (
            <Button variant="outline" onClick={handleBack} disabled={isConnecting}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 'folders' && (
            <Button onClick={handleConfirm} disabled={isLoading}>
              Continue
            </Button>
          )}
          {step === 'confirm' && (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <FolderSync className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
