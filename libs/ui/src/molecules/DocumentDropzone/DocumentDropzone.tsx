import { useId, useRef, type DragEvent } from 'react';
import { Text } from '../../atoms/Text';

export type DocumentDropzoneStatus =
  'idle' | 'checking' | 'accepted' | 'glare' | 'blurry' | 'wrong_type';

export interface DocumentDropzoneProps {
  /** e.g. "Dara Reyes — Driver's license" */
  label: string;
  status: DocumentDropzoneStatus;
  onFileSelected: (file: File) => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,application/pdf';

/** Exact user-facing copy is AC-mandated (US-CW-005 AC-01/02/03) — kept here rather than parent-supplied so every call site shows identical wording. */
const STATUS_COPY: Partial<Record<DocumentDropzoneStatus, string>> = {
  accepted: 'Quality check passed',
  glare: "We couldn't read your document. Make sure it's well-lit, in focus, and fully in frame.",
  blurry: 'Hold the camera steady and try again.',
  wrong_type:
    "This doesn't look like a valid ID. Please upload a driver's license, passport, or state ID.",
};

const RETRY_LABEL: Partial<Record<DocumentDropzoneStatus, string>> = {
  glare: 'Retake photo',
  blurry: 'Retake photo',
  wrong_type: 'Choose a different file',
};

function toneFor(status: DocumentDropzoneStatus): 'positive' | 'warning' | 'negative' | 'muted' {
  if (status === 'accepted') return 'positive';
  if (status === 'glare' || status === 'blurry') return 'warning';
  if (status === 'wrong_type') return 'negative';
  return 'muted';
}

/**
 * Presentational only — the actual glare/blur pixel analysis and document-type verdict are
 * decided upstream (useSubmitDocument's client-side quality gate + the server's classify step);
 * this component just reflects whatever `status` the caller passes and reports file selection.
 */
export function DocumentDropzone({ label, status, onFileSelected }: DocumentDropzoneProps) {
  const inputId = useId();
  const retryInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  const message = STATUS_COPY[status];
  const retryLabel = RETRY_LABEL[status];

  return (
    <div>
      <Text as="p" size="label" weight="semibold" className="mb-1">
        {label}
      </Text>

      {status === 'idle' || status === 'checking' ? (
        <div
          data-testid="document-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="border-cl-border-2 rounded-[10px] border-[1.5px] border-dashed p-6 text-center"
        >
          <Text as="p" size="label" weight="medium" className="mb-0.5">
            Drag & drop or{' '}
            <label htmlFor={inputId} className="text-cl-accent-text cursor-pointer">
              browse
            </label>
          </Text>
          <Text as="p" size="mono" tone="faint">
            JPG, PNG, or PDF · up to 10 MB
          </Text>
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED_TYPES}
            aria-label="browse"
            className="sr-only"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </div>
      ) : (
        <div data-testid="document-dropzone" className="border-cl-border rounded-[10px] border p-3">
          {message ? (
            <Text as="p" size="label" tone={toneFor(status)} className="mb-2">
              {message}
            </Text>
          ) : null}
          {retryLabel ? (
            <>
              <button
                type="button"
                onClick={() => retryInputRef.current?.click()}
                className="bg-cl-accent block w-full cursor-pointer rounded-lg px-4 py-2.5 text-center text-[13px] font-semibold text-white"
              >
                {retryLabel}
              </button>
              <input
                ref={retryInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                aria-label={retryLabel}
                className="sr-only"
                onChange={(event) => handleFiles(event.target.files)}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
