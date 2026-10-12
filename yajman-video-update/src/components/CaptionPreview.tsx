import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { renderCaption } from '../services/captionRenderer';
import type { CaptionStyle } from '../services/captionStyle';
import { QUICK_ANCHORS, clamp, computeOverlayPosition, type Anchor } from '../utils/placement';
import type { VideoMeta } from '../utils/videoMeta';

const SAMPLE_TEXT = 'Your caption appears here';
const KEY_STEP = 0.01;

interface Props {
  file: File;
  meta: VideoMeta;
  caption: string;
  style: CaptionStyle;
  anchor: Anchor;
  onAnchorChange: (anchor: Anchor) => void;
}

interface Strip {
  url: string;
  width: number;
  height: number;
}

export function CaptionPreview({ file, meta, caption, style, anchor, onAnchorChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const grabOffset = useRef<Anchor | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>();
  const [strip, setStrip] = useState<Strip>();

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (strip) URL.revokeObjectURL(strip.url);
    };
  }, [strip]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const image = await renderCaption(caption.trim() || SAMPLE_TEXT, meta.width, style);
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([image.png], { type: 'image/png' }));
        setStrip({ url, width: image.width, height: image.height });
      } catch {
        // The preview is optional; generating the video reports real errors.
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [caption, style, meta.width]);

  if (!videoUrl) return null;

  const placement = strip ? computeOverlayPosition(strip, meta, anchor) : null;

  const pointerFraction = (event: PointerEvent): Anchor => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!strip || !placement) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointer = pointerFraction(event);
    grabOffset.current = {
      x: pointer.x - (placement.x + strip.width / 2) / meta.width,
      y: pointer.y - (placement.y + strip.height / 2) / meta.height,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (!grabOffset.current) return;
    const pointer = pointerFraction(event);
    onAnchorChange({
      x: clamp(pointer.x - grabOffset.current.x, 0, 1),
      y: clamp(pointer.y - grabOffset.current.y, 0, 1),
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    const delta: Record<string, Anchor> = {
      ArrowLeft: { x: -KEY_STEP, y: 0 },
      ArrowRight: { x: KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: -KEY_STEP },
      ArrowDown: { x: 0, y: KEY_STEP },
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    onAnchorChange({ x: clamp(anchor.x + move.x, 0, 1), y: clamp(anchor.y + move.y, 0, 1) });
  };

  return (
    <section className="field">
      <span className="field-label">Preview</span>
      <div
        ref={containerRef}
        className="preview"
        style={{
          aspectRatio: `${meta.width} / ${meta.height}`,
          maxWidth: meta.height > meta.width ? '320px' : '100%',
        }}
      >
        <video src={`${videoUrl}#t=0.1`} muted preload="metadata" />
        {strip && placement && (
          <img
            src={strip.url}
            alt="Caption. Drag, or use the arrow keys, to move it."
            tabIndex={0}
            draggable={false}
            style={{
              left: `${(placement.x / meta.width) * 100}%`,
              top: `${(placement.y / meta.height) * 100}%`,
              width: `${(strip.width / meta.width) * 100}%`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => (grabOffset.current = null)}
            onPointerCancel={() => (grabOffset.current = null)}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
      <div className="row">
        <span className="hint">Drag the caption to move it, or</span>
        <div className="segmented" role="group" aria-label="Quick position">
          <button type="button" onClick={() => onAnchorChange(QUICK_ANCHORS.top)}>Top</button>
          <button type="button" onClick={() => onAnchorChange(QUICK_ANCHORS.middle)}>Middle</button>
          <button type="button" onClick={() => onAnchorChange(QUICK_ANCHORS.bottom)}>Bottom</button>
        </div>
      </div>
    </section>
  );
}
