import { useEffect, useRef, useState } from 'react';
import { runBatch, type BatchItem } from '../services/batchRunner';
import { renderYajmanOverlay, type YajmanDetails, type YajmanVideoEntry } from '../services/yajmanOverlay';
import { VideoProcessor } from '../services/videoProcessor';
import { buildReportCsv, buildZip, type ZipEntry } from '../services/zipPackager';
import type { Timeframe } from '../utils/timeframe';
import type { VideoMeta } from '../utils/videoMeta';

export type Phase = 'idle' | 'loading' | 'rendering' | 'done' | 'error';

export interface RenderSettings {
  baseFile: File;
  meta: VideoMeta;
  timeframe: Timeframe;
}

export type RowStarterVideo = Pick<RenderSettings, 'baseFile' | 'meta'>;

interface BatchSettings {
  shared: RenderSettings | null;
  rowStarters: ReadonlyMap<number, RowStarterVideo>;
}

export function useVideoGenerator(assetBaseUrl = '', endingDuration = 0) {
  const processorRef = useRef<VideoProcessor | null>(null);
  const loadedBaseRef = useRef<File | null>(null);
  const cancelRef = useRef(false);
  const itemsRef = useRef<BatchItem[]>([]);
  const outputsRef = useRef(new Map<number, Uint8Array>());
  const detailsRef = useRef(new Map<number, YajmanDetails>());
  const jobRef = useRef<BatchSettings | null>(null);
  const loadedEndingRef = useRef(false);
  const loadedAudioRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      processorRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (zipUrl) URL.revokeObjectURL(zipUrl);
    };
  }, [zipUrl]);

  async function prepare(baseFile?: File): Promise<VideoProcessor> {
    const processor = (processorRef.current ??= new VideoProcessor());
    await processor.load();
    if (baseFile && loadedBaseRef.current !== baseFile) {
      await processor.setBaseVideo(baseFile);
      loadedBaseRef.current = baseFile;
    }
    if (!loadedEndingRef.current) {
      const ending = await fetch(`${assetBaseUrl.replace(/\/+$/, '')}/remaining_fixed_video.mp4`);
      if (!ending.ok) throw new Error('Could not load the fixed ending video.');
      await processor.setEndingVideo(await ending.blob());
      loadedEndingRef.current = true;
    }
    if (!loadedAudioRef.current) {
      const soundtrack = await fetch(`${assetBaseUrl.replace(/\/+$/, '')}/full_audio.mp3`);
      if (!soundtrack.ok) throw new Error('Could not load the soundtrack.');
      await processor.setAudioTrack(await soundtrack.blob());
      loadedAudioRef.current = true;
    }
    return processor;
  }

  async function renderOne(
    processor: VideoProcessor,
    details: YajmanDetails,
    settings: RenderSettings,
    onProgress?: (ratio: number) => void,
  ): Promise<Uint8Array> {
    const image = await renderYajmanOverlay(details, settings.meta.width, settings.meta.height, assetBaseUrl);
    return processor.render(image.png, settings.timeframe, settings.meta.width, settings.meta.height, onProgress);
  }

  function reset() {
    setProgress(0);
    setPhase('idle');
    setVideoUrl(null);
    setZipUrl(null);
    setItems([]);
    setMessage(null);
    itemsRef.current = [];
    outputsRef.current = new Map();
    detailsRef.current = new Map();
    jobRef.current = null;
    cancelRef.current = false;
  }

  async function clearSourceVideo() {
    if (loadedBaseRef.current) {
      await processorRef.current?.clearBaseVideo();
      loadedBaseRef.current = null;
    }
  }

  async function generateSingle(details: YajmanDetails, settings: RenderSettings) {
    reset();
    await renderSingle(details, settings);
  }

  async function generateSingleItem(details: YajmanDetails, settings: RenderSettings) {
    setProgress(0);
    setVideoUrl(null);
    setMessage(null);
    setPhase('loading');
    await renderSingle(details, settings);
  }

  async function renderSingle(details: YajmanDetails, settings: RenderSettings) {
    try {
      setPhase('loading');
      const processor = await prepare(settings.baseFile);
      setPhase('rendering');
      const bytes = await renderOne(processor, details, settings, setProgress);
      setVideoUrl(URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' })));
      setPhase('done');
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      await clearSourceVideo();
    }
  }

  function clearSingleVideo() {
    setVideoUrl(null);
    setProgress(0);
    setMessage(null);
    if (itemsRef.current.length === 0) setPhase('idle');
  }

  async function runPending(indices: number[]) {
    const batch = jobRef.current;
    if (!batch) return;

    cancelRef.current = false;
    setMessage(null);
    try {
      setPhase('loading');
      const processor = await prepare();
      setPhase('rendering');

      const total = itemsRef.current.length;
      const finished = () =>
        itemsRef.current.filter((item) => item.status === 'done' || item.status === 'failed').length;

      const finalItems = await runBatch(itemsRef.current, indices, {
        renderItem: async (item) => {
          const rowStarter = batch.rowStarters.get(item.index);
          const settings = rowStarter
            ? {
              ...rowStarter,
              timeframe: { start: 0, end: rowStarter.meta.duration + endingDuration },
            }
            : batch.shared;
          if (!settings) throw new Error('Choose a shared starter video or assign a clip to this row.');
          await prepare(settings.baseFile);
          return renderOne(
            processor,
            detailsRef.current.get(item.index) ?? { date: '', fullName: '', number: '', gotra: '', pitraName: '' },
            settings,
            (ratio) => setProgress((finished() + ratio) / total),
          );
        },
        onResult: (item, bytes) => outputsRef.current.set(item.index, bytes),
        onChange: (next) => {
          itemsRef.current = next;
          setItems(next);
          setProgress(finished() / total);
        },
        shouldCancel: () => cancelRef.current,
      });

      packageResults(finalItems);
      setPhase('done');
    } catch (error) {
      setPhase('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      await clearSourceVideo();
    }
  }

  function packageResults(finalItems: BatchItem[]) {
    const entries: ZipEntry[] = finalItems.flatMap((item) => {
      const data = outputsRef.current.get(item.index);
      return item.status === 'done' && data ? [{ name: item.fileName, data }] : [];
    });

    if (entries.length === 0) {
      setZipUrl(null);
      setMessage('No videos were created.');
      return;
    }

    entries.push({ name: 'report.csv', data: new TextEncoder().encode(buildReportCsv(finalItems)) });
    setZipUrl(URL.createObjectURL(buildZip(entries)));

    const notStarted = finalItems.filter((item) => item.status === 'pending').length;
    const failed = finalItems.some((item) => item.status === 'failed');
    if (notStarted === 0 && !failed) outputsRef.current = new Map();
    if (notStarted > 0) {
      setMessage(`Stopped early. The ZIP has the ${entries.length - 1} finished videos.`);
    }
  }

  async function generateBatch(
    entries: YajmanVideoEntry[],
    shared: RenderSettings | null,
    rowStarters: ReadonlyMap<number, RowStarterVideo>,
  ) {
    reset();
    jobRef.current = { shared, rowStarters: new Map(rowStarters) };
    const initial: BatchItem[] = entries.map((entry, index) => ({
      index,
      caption: [entry.details.fullName, entry.details.gotra, entry.details.pitraName].filter(Boolean).join(' · '),
      fileName: entry.fileName,
      status: 'pending',
    }));
    detailsRef.current = new Map(entries.map((entry, index) => [index, entry.details]));
    itemsRef.current = initial;
    setItems(initial);
    await runPending(initial.map((item) => item.index));
  }

  async function retryFailed() {
    const failed = itemsRef.current.filter((item) => item.status === 'failed').map((item) => item.index);
    if (failed.length > 0) await runPending(failed);
  }

  function cancel() {
    cancelRef.current = true;
  }

  return {
    phase,
    busy: phase === 'loading' || phase === 'rendering',
    progress,
    videoUrl,
    zipUrl,
    items,
    message,
    generateSingle,
    generateSingleItem,
    clearSingleVideo,
    generateBatch,
    retryFailed,
    cancel,
    reset,
    clearSourceVideo,
  };
}
