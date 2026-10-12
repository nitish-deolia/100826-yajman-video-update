import { useEffect, useRef, useState } from 'react';
import { renderYajmanOverlay, type YajmanDetails } from '../services/yajmanOverlay';
import type { VideoMeta } from '../utils/videoMeta';

interface Props {
  file: File | null;
  meta: VideoMeta | null;
  details: YajmanDetails;
  start: string;
  end: string;
  assetBaseUrl?: string;
  loading?: boolean;
}

export function VideoPreview({ file, meta, details, start, end, assetBaseUrl = '', loading = false }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const previewTimeRef = useRef(0);
  const overlayRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncFullscreenState = () => {
      setBrowserFullscreen(document.fullscreenElement === previewRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      previewTimeRef.current = 0;
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    previewTimeRef.current = 0;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setOverlayUrl(null);
    setPreviewError(null);
    if (!file || !meta) return;

    const timer = window.setTimeout(() => {
      renderYajmanOverlay(details, meta.width, meta.height, assetBaseUrl)
        .then(({ png }) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
          setOverlayUrl(objectUrl);
        })
        .catch((error: unknown) => {
          if (!cancelled) setPreviewError(error instanceof Error ? error.message : 'Could not create the preview.');
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, meta, details, assetBaseUrl]);

  const startTime = start.trim() === '' ? Number.NaN : Number(start);
  const endTime = end.trim() === '' ? Number.NaN : Number(end);
  const isOverlayVisible = (time: number) => Number.isFinite(startTime) && Number.isFinite(endTime) && time >= startTime && time <= endTime;
  const handleTimeUpdate = (video: HTMLVideoElement) => {
    previewTimeRef.current = video.currentTime;
    overlayRef.current?.classList.toggle('is-hidden', !isOverlayVisible(video.currentTime));
  };
  const isFullscreen = fallbackFullscreen || browserFullscreen;
  const toggleFullscreen = async () => {
    const preview = previewRef.current;
    if (!preview) return;

    if (document.fullscreenElement === preview) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    if (!preview.requestFullscreen) {
      setFallbackFullscreen(true);
      return;
    }
    try {
      await preview.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  };

  return (
    <section className="preview-card" aria-label="Video preview">
      <div className="preview-card-heading">
        <div><p className="eyebrow">LIVE PREVIEW</p><h2>{file ? 'Your opening video' : 'Preview will appear here'}</h2></div>
        {file && meta && <span className="preview-badge">{meta.width} × {meta.height}</span>}
      </div>
      {file && videoUrl ? <div ref={previewRef} className={`video-preview${fallbackFullscreen ? ' is-expanded' : ''}`} style={{ aspectRatio: meta ? `${meta.width} / ${meta.height}` : '16 / 9' }}>
        <video src={videoUrl} controls controlsList="nofullscreen" autoPlay muted loop playsInline onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)} />
        {overlayUrl && <img ref={overlayRef} className={isOverlayVisible(previewTimeRef.current) ? '' : 'is-hidden'} src={overlayUrl} alt="Personalised footer and logo preview" />}
        <button className="preview-fullscreen" type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit full screen preview' : 'Open full screen preview'} aria-pressed={isFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {isFullscreen
              ? <path d="M8 3v5H3M16 3v5h5M3 16h5v5m13-5h-5v5" />
              : <path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5" />}
          </svg>
        </button>
      </div> : <div className="preview-placeholder"><span className="preview-play">▶</span><span>Choose an MP4 video to see the footer placement</span></div>}
      <div className="preview-caption">
        {loading ? <span className="processing-indicator">Reading video details…</span> : file ? <><strong>{file.name}</strong><span>{meta && !overlayUrl ? 'Preparing the footer preview…' : meta ? `${meta.duration.toFixed(1)} seconds · footer shows from ${start || '0'}s to ${end || 'end'}s` : 'Video details are being loaded.'}</span></> : <span>Preview updates as you edit the details.</span>}
        {previewError && <span className="error">{previewError}</span>}
      </div>
    </section>
  );
}
