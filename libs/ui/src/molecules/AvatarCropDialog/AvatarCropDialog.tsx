import { useRef, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../../atoms/Button';
import { Text } from '../../atoms/Text';

/** Edge length in px of the square avatar the crop produces. */
const OUTPUT_SIZE = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export interface AvatarCropDialogProps {
  open: boolean;
  /** The source image to crop, as a data/object URL (already validated for type/size/dimension). */
  src: string;
  /** Called with the cropped square image as a PNG data URL when the user confirms (AC-05). */
  onConfirm: (dataUrl: string) => void;
  /** Called when the user cancels or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Client-side square crop/resize for a new avatar (US-CW-034 AC-05). The whole crop happens in the
 * browser — the image is drawn to a canvas and read back as a data URL, so the raw photo never
 * reaches a third-party image service. A single zoom control drives a centered cover-crop, which is
 * enough to square a non-square upload deterministically without a full pan/zoom editor. If the
 * environment can't rasterize (no 2D canvas context — e.g. a jsdom test), it falls back to the
 * source URL so the flow still completes.
 */
export function AvatarCropDialog({ open, src, onConfirm, onCancel }: AvatarCropDialogProps) {
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleConfirm() {
    onConfirm(cropToSquare(imgRef.current, zoom) ?? src);
    setZoom(1);
  }

  return (
    <Modal open={open} onOpenChange={(next) => (next ? undefined : onCancel())} maxWidth={360}>
      <Modal.Title asChild>
        <Text as="h2" size="heading" className="mb-1">
          Crop your photo
        </Text>
      </Modal.Title>
      <Modal.Description asChild>
        <Text as="p" tone="muted" className="mb-4 text-[12.5px]">
          Zoom to frame your photo. It will be cropped to a square.
        </Text>
      </Modal.Description>

      <div className="bg-cl-inset border-cl-border mx-auto mb-4 h-56 w-56 overflow-hidden rounded-full border">
        {/* crossOrigin so the canvas isn't tainted when the source is a remote URL. */}
        <img
          ref={imgRef}
          src={src}
          alt="Avatar preview"
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>

      <label className="mb-5 block">
        <Text as="span" size="label" tone="muted" className="mb-1 block">
          Zoom
        </Text>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          aria-label="Zoom"
          className="accent-cl-accent w-full"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleConfirm}>
          Save photo
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Draws a centered, zoomed cover-crop of `img` into an OUTPUT_SIZE² canvas and returns a PNG data
 * URL. Returns null when there's nothing to draw (image not yet decoded) or no 2D context is
 * available (test env), so the caller can fall back to the original source.
 */
function cropToSquare(img: HTMLImageElement | null, zoom: number): string | null {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // The source square is the largest centered square that, scaled by `zoom`, fills the output.
  const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    // A tainted canvas (cross-origin source without CORS headers) can't be exported — fall back.
    return null;
  }
}
