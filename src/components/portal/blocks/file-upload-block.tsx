'use client';

import { useState, useCallback, useRef } from 'react';
import type { PortalFileUpload } from '@/types';

interface FileSlot {
  label: string;
  description: string;
}

interface FileUploadBlockProps {
  files: FileSlot[];
  projectToken: string;
  projectId: string;
  blockId: string;
  existingUploads: PortalFileUpload[];
}

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.eps'];
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SlotState = {
  uploading: boolean;
  error: string | null;
  /** Optimistic upload after a successful POST (before page refresh) */
  justUploaded: { filename: string } | null;
};

function SlotUploader({
  slot,
  slotIndex,
  projectToken,
  blockId,
  existingUpload,
}: {
  slot: FileSlot;
  slotIndex: number;
  projectToken: string;
  blockId: string;
  existingUpload: PortalFileUpload | undefined;
}) {
  const [state, setState] = useState<SlotState>({
    uploading: false,
    error: null,
    justUploaded: null,
  });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      // Client-side validation
      const ext = getExtension(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setState((s) => ({
          ...s,
          error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        }));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setState((s) => ({
          ...s,
          error: `File too large (${formatFileSize(file.size)}). Maximum is 3 MB.`,
        }));
        return;
      }

      setState({ uploading: true, error: null, justUploaded: null });

      try {
        const formData = new FormData();
        formData.append('token', projectToken);
        formData.append('blockId', blockId);
        formData.append('slotIndex', String(slotIndex));
        formData.append('fileLabel', slot.label);
        formData.append('fileDescription', slot.description);
        formData.append('file', file);

        const res = await fetch('/api/portal/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Upload failed (${res.status})`);
        }

        setState({
          uploading: false,
          error: null,
          justUploaded: { filename: file.name },
        });
      } catch (err) {
        setState({
          uploading: false,
          error: err instanceof Error ? err.message : 'Upload failed',
          justUploaded: null,
        });
      }
    },
    [projectToken, blockId, slotIndex, slot.label, slot.description],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [upload],
  );

  // Determine display state
  const status = existingUpload?.upload_status;
  const showDropZone =
    !state.justUploaded &&
    (!existingUpload || status === 'pending' || status === 'rejected');
  const showUploaded =
    state.justUploaded || status === 'uploaded';
  const showApproved = !state.justUploaded && status === 'approved';
  const showRejected = !state.justUploaded && status === 'rejected';

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="mb-2">
        <h4 className="font-medium text-gray-900 text-sm">{slot.label}</h4>
        {slot.description && (
          <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
        )}
      </div>

      {/* Approved state */}
      {showApproved && (
        <div className="flex items-center gap-2 py-2">
          <svg
            className="w-5 h-5 text-green-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-green-700 font-medium">Approved</span>
          <span className="text-xs text-gray-500 truncate">
            {existingUpload?.original_filename}
          </span>
        </div>
      )}

      {/* Rejected state */}
      {showRejected && (
        <div className="mb-3">
          <div className="flex items-center gap-2 py-1">
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Rejected
            </span>
            <span className="text-xs text-gray-500 truncate">
              {existingUpload?.original_filename}
            </span>
          </div>
          {existingUpload?.rejection_note && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 rounded p-2">
              {existingUpload.rejection_note}
            </p>
          )}
        </div>
      )}

      {/* Uploaded / Pending review state */}
      {showUploaded && !showApproved && (
        <div className="flex items-center gap-2 py-2">
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            Pending review
          </span>
          <span className="text-xs text-gray-500 truncate">
            {state.justUploaded?.filename || existingUpload?.original_filename}
          </span>
        </div>
      )}

      {/* Drop zone for pending / rejected / no upload */}
      {showDropZone && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-[#023A2D] bg-green-50' : 'border-gray-300 hover:border-gray-400'}
              ${state.uploading ? 'opacity-60 pointer-events-none' : ''}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />

            {state.uploading ? (
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="animate-spin h-6 w-6 text-[#023A2D]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.182 3.408A3.75 3.75 0 0118 19.5H6.75z"
                  />
                </svg>
                <p className="text-sm text-gray-600">
                  Drag &amp; drop or{' '}
                  <span className="text-[#023A2D] font-medium underline">
                    browse
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  PDF, PNG, JPG, EPS &middot; Max 3 MB
                </p>
              </div>
            )}
          </div>

          {state.error && (
            <p className="text-xs text-red-600 mt-2">{state.error}</p>
          )}
        </>
      )}
    </div>
  );
}

export function FileUploadBlock({
  files,
  projectToken,
  projectId,
  blockId,
  existingUploads,
}: FileUploadBlockProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-[#023A2D] mb-3">
        File Uploads
      </h3>
      <div className="space-y-3">
        {files.map((slot, index) => {
          const existing = existingUploads.find(
            (u) => u.block_id === blockId && u.slot_index === index,
          );
          return (
            <SlotUploader
              key={`${blockId}-${index}`}
              slot={slot}
              slotIndex={index}
              projectToken={projectToken}
              blockId={blockId}
              existingUpload={existing}
            />
          );
        })}
      </div>
    </div>
  );
}
