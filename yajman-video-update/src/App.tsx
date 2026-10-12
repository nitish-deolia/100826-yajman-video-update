import { useEffect, useMemo, useRef, useState } from 'react';
import { BatchResults } from './components/BatchResults';
import { ExcelPanel } from './components/ExcelPanel';
import { Modal } from './components/Modal';
import { TimeframeInput } from './components/TimeframeInput';
import { VideoPreview } from './components/VideoPreview';
import { LIMITS } from './constants';
import { useVideoGenerator, type RenderSettings, type RowStarterVideo } from './hooks/useVideoGenerator';
import type { YajmanDetails } from './services/yajmanOverlay';
import { parseExcel, type ExcelData } from './utils/excel';
import { normalizeTimeframe, parseSeconds } from './utils/timeframe';
import { readVideoMeta, readVideoMetaFromUrl, type VideoMeta } from './utils/videoMeta';
import {
  buildYajmanEntries,
  EMPTY_FIELD_MAP,
  mapExcelRow,
  suggestColumnMapping,
  YAJMAN_FIELDS,
  type FieldMap,
} from './utils/yajmanExcel';

type Mode = 'single' | 'excel';
const EMPTY_DETAILS: YajmanDetails = { date: '', fullName: '', number: '', gotra: '', pitraName: '' };
export interface YajmanVideoWidgetProps {
  /** Base URL where footer.PNG, logo.png, remaining_fixed_video.mp4, and full_audio.mp3 are hosted. */
  assetBaseUrl?: string;
}

export default function App({ assetBaseUrl = import.meta.env.BASE_URL }: YajmanVideoWidgetProps) {
  const [mode, setMode] = useState<Mode>('single');
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [endingDuration, setEndingDuration] = useState(0);
  const generator = useVideoGenerator(assetBaseUrl, endingDuration);
  const [rowStarters, setRowStarters] = useState<Map<number, RowStarterVideo>>(() => new Map());
  const [rowVideoErrors, setRowVideoErrors] = useState<Map<number, string>>(() => new Map());
  const [individualRowIndex, setIndividualRowIndex] = useState<number | null>(null);
  const [individualFileName, setIndividualFileName] = useState('');
  const [individualValidationError, setIndividualValidationError] = useState<{ index: number; message: string } | null>(null);
  const [rowVideoLoading, setRowVideoLoading] = useState(false);
  const [details, setDetails] = useState<YajmanDetails>(EMPTY_DETAILS);
  const [excel, setExcel] = useState<ExcelData | null>(null);
  const [mapping, setMapping] = useState<FieldMap>(EMPTY_FIELD_MAP);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [startText, setStartText] = useState('0');
  const [endText, setEndText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewMode, setPreviewMode] = useState<'source' | 'result' | null>(null);
  const busy = generator.busy;
  const outputDuration = (meta?.duration ?? 0) + endingDuration;

  useEffect(() => {
    let active = true;
    const endingUrl = `${assetBaseUrl.replace(/\/+$/, '')}/remaining_fixed_video.mp4`;
    void readVideoMetaFromUrl(endingUrl)
      .then((endingMeta) => { if (active) setEndingDuration(endingMeta.duration); })
      .catch(() => { /* Rendering reports an asset loading error if the ending is unavailable. */ });
    return () => { active = false; };
  }, [assetBaseUrl]);

  useEffect(() => {
    if (!meta || endingDuration <= 0) return;
    setEndText((current) => current === String(meta.duration) || current === ''
      ? String(meta.duration + endingDuration)
      : current);
  }, [meta, endingDuration]);
  const individualResultRef = useRef<{ url: string | null; zipUrl: string | null; rowIndex: number | null }>({ url: null, zipUrl: null, rowIndex: null });
  individualResultRef.current = { url: generator.videoUrl, zipUrl: generator.zipUrl, rowIndex: individualRowIndex };

  function closePreview() {
    setPreviewMode(null);
  }

  function clearGeneratedAfterDownload() {
    const generatedArtifact = { url: generator.videoUrl, zipUrl: generator.zipUrl, rowIndex: individualRowIndex };
    window.setTimeout(() => {
      if (individualResultRef.current.url !== generatedArtifact.url
        || individualResultRef.current.zipUrl !== generatedArtifact.zipUrl
        || individualResultRef.current.rowIndex !== generatedArtifact.rowIndex) return;
      generator.reset();
      closePreview();
    }, 1500);
  }

  function clearIndividualAfterDownload() {
    const url = generator.videoUrl;
    const zipUrl = generator.zipUrl;
    const rowIndex = individualRowIndex;
    window.setTimeout(() => {
      if (individualResultRef.current.url !== url || individualResultRef.current.zipUrl !== zipUrl || individualResultRef.current.rowIndex !== rowIndex) return;
      generator.clearSingleVideo();
      setIndividualRowIndex(null);
      setIndividualFileName('');
      setIndividualValidationError(null);
      closePreview();
    }, 1500);
  }

  const sampleDetails = useMemo(() => {
    if (mode === 'single' || !excel?.rows[0]) return details;
    return mapExcelRow(excel.rows[0], mapping);
  }, [mode, details, excel, mapping]);

  function switchMode(nextMode: Mode) {
    generator.reset();
    closePreview();
    setMode(nextMode);
    setFormError(null);
    setSubmitted(false);
    setExcelError(null);
    setIndividualRowIndex(null);
    setIndividualFileName('');
    setIndividualValidationError(null);
  }

  async function handleVideoPick(file?: File) {
    if (!file) return;
    setVideoError(null);
    setFormError(null);
    setTimeError(null);
    setVideoLoading(true);
    try {
      const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      if (!isMp4) throw new Error('Please choose an MP4 video.');
      if (file.size > LIMITS.maxVideoBytes) throw new Error(`This file is larger than ${LIMITS.maxVideoBytes / 1024 / 1024} MB.`);
      const info = await readVideoMeta(file);
      if (!Number.isFinite(info.duration) || info.duration <= 0) throw new Error('The video has no readable duration.');
      if (info.duration > LIMITS.maxVideoSeconds) throw new Error(`Keep the starter video under ${LIMITS.maxVideoSeconds} seconds.`);
      if (!info.width || !info.height) throw new Error('Could not read the video dimensions.');
      generator.reset();
      closePreview();
      setIndividualRowIndex(null);
      setIndividualFileName('');
      setIndividualValidationError(null);
      await generator.clearSourceVideo();
      setBaseFile(file);
      setMeta(info);
      setStartText('0');
      setEndText(String(info.duration + endingDuration));
      setTimeError(null);
      setRowVideoErrors(new Map());
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Could not read the video.');
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleRowVideoPick(index: number, file?: File) {
    if (!file) return;
    generator.reset();
    closePreview();
    setIndividualRowIndex(null);
    setIndividualFileName('');
    setIndividualValidationError(null);
    setRowVideoLoading(true);
    setFormError(null);
    try {
      const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      if (!isMp4) throw new Error('Please choose an MP4 video.');
      if (file.size > LIMITS.maxVideoBytes) throw new Error(`This file is larger than ${LIMITS.maxVideoBytes / 1024 / 1024} MB.`);
      const info = await readVideoMeta(file);
      if (!Number.isFinite(info.duration) || info.duration <= 0) throw new Error('The video has no readable duration.');
      if (info.duration > LIMITS.maxVideoSeconds) throw new Error(`Keep the starter video under ${LIMITS.maxVideoSeconds} seconds.`);
      if (!info.width || !info.height) throw new Error('Could not read the video dimensions.');

      setRowStarters((current) => new Map(current).set(index, { baseFile: file, meta: info }));
      setRowVideoErrors((current) => {
        const next = new Map(current);
        next.delete(index);
        return next;
      });
    } catch (error) {
      setRowStarters((current) => {
        const next = new Map(current);
        next.delete(index);
        return next;
      });
      setRowVideoErrors((current) => new Map(current).set(index, error instanceof Error ? error.message : 'Could not read the video.'));
    } finally {
      setRowVideoLoading(false);
    }
  }

  function useSharedVideoForRow(index: number) {
    generator.reset();
    setIndividualRowIndex(null);
    setIndividualFileName('');
    setIndividualValidationError(null);
    setRowStarters((current) => {
      const next = new Map(current);
      next.delete(index);
      return next;
    });
    setRowVideoErrors((current) => {
      const next = new Map(current);
      next.delete(index);
      return next;
    });
  }

  async function handleRemoveVideo() {
    closePreview();
    generator.reset();
    setIndividualRowIndex(null);
    setIndividualFileName('');
    setIndividualValidationError(null);
    await generator.clearSourceVideo();
    setBaseFile(null);
    setMeta(null);
    setStartText('0');
    setEndText('');
    setTimeError(null);
    setVideoError(null);
  }

  async function handleExcelPick(file?: File) {
    if (!file) return;
    generator.reset();
    setIndividualRowIndex(null);
    setIndividualFileName('');
    setIndividualValidationError(null);
    setExcelError(null);
    setFormError(null);
    try {
      const data = await parseExcel(file);
      if (data.rows.length > LIMITS.maxBatchRows) throw new Error(`This sheet has ${data.rows.length} rows. The maximum is ${LIMITS.maxBatchRows} per batch.`);
      setExcel(data);
      setMapping(suggestColumnMapping(data.headers));
      setRowStarters(new Map());
      setRowVideoErrors(new Map());
    } catch (error) {
      setExcel(null);
      setRowStarters(new Map());
      setRowVideoErrors(new Map());
      setExcelError(error instanceof Error ? error.message : 'Could not read the Excel file.');
    }
  }

  async function handleCreateRowVideo(index: number) {
    if (!excel) return;
    closePreview();
    setIndividualRowIndex(index);
    setIndividualFileName('');
    setIndividualValidationError(null);
    setVideoError(null);
    setFormError(null);
    generator.clearSingleVideo();
    setRowVideoErrors((current) => {
      if (!current.has(index)) return current;
      const next = new Map(current);
      next.delete(index);
      return next;
    });

    const rowStarter = rowStarters.get(index);
    let settings: RenderSettings;
    if (rowStarter) {
      settings = { ...rowStarter, timeframe: { start: 0, end: rowStarter.meta.duration + endingDuration } };
    } else if (baseFile && meta) {
      try {
        settings = { baseFile, meta, timeframe: normalizeTimeframe(parseSeconds(startText), parseSeconds(endText), meta.duration + endingDuration) };
      } catch (error) {
        setIndividualValidationError({ index, message: error instanceof Error ? error.message : 'Check the shared video start and end times.' });
        return;
      }
    } else {
      setIndividualValidationError({ index, message: 'Choose a clip for this row or add a shared starter.' });
      return;
    }

    const entry = buildYajmanEntries(excel, mapping)[index];
    setIndividualFileName(entry?.fileName ?? `yajman-${index + 1}.mp4`);
    await generator.generateSingleItem(mapExcelRow(excel.rows[index], mapping), settings);
  }

  async function handleGenerate() {
    setSubmitted(true);
    setFormError(null);
    let hasValidationError = false;
    if (mode === 'single' && !details.fullName.trim()) {
      hasValidationError = true;
    }
    if (mode === 'excel' && !excel) {
      setExcelError('Choose a spreadsheet with at least one data row.');
      hasValidationError = true;
    }
    const rowsNeedingShared = mode === 'excel' && excel
      ? excel.rows.map((_, index) => index).filter((index) => !rowStarters.has(index))
      : [];
    const needsSharedVideo = mode === 'single' || rowsNeedingShared.length > 0;
    if (needsSharedVideo && (!baseFile || !meta)) {
      setVideoError(mode === 'excel' ? 'Choose a shared starter or assign a clip to every row.' : 'Choose a valid MP4 starter video to continue.');
      if (mode === 'excel') {
        setRowVideoErrors((current) => {
          const next = new Map(current);
          for (const index of rowsNeedingShared) {
            if (!next.has(index)) next.set(index, 'Choose a clip for this row or add a shared starter.');
          }
          return next;
        });
      }
      hasValidationError = true;
    }
    if (hasValidationError) {
      setFormError('Check the highlighted fields before creating your video.');
      return;
    }
    if (needsSharedVideo && (!baseFile || !meta)) return;
    setVideoError(null);
    setExcelError(null);
    if (mode === 'excel') {
      setIndividualRowIndex(null);
      setIndividualFileName('');
      setIndividualValidationError(null);
    }
    let settings: RenderSettings | null = null;
    if (needsSharedVideo && baseFile && meta) {
      try {
        settings = { baseFile, meta, timeframe: normalizeTimeframe(parseSeconds(startText), parseSeconds(endText), meta.duration + endingDuration) };
      } catch (error) {
        setTimeError(error instanceof Error ? error.message : 'Check the start and end times.');
        return;
      }
    }
    setTimeError(null);
    if (mode === 'single' && settings) await generator.generateSingle(details, settings);
    else if (mode === 'excel' && excel) await generator.generateBatch(buildYajmanEntries(excel, mapping), settings, rowStarters);
  }

  return (
    <main className="yajman-widget">
        <header className="brand-header">
          <img src={`${assetBaseUrl.replace(/\/+$/, '')}/logo.png`} alt="Yajman" />
          <div><p className="eyebrow">YAJMAN VIDEO MAKER</p><h1>Make a personalised video</h1></div>
        </header>
        <p className="intro">Add yajman details to your opening clip. We’ll add the footer and append the standard video on this device.</p>

        <div className="workspace">
          <div className="editor-column">
            <section className="editor-card">
              <div className="section-heading"><span className="step-number">1</span><div><h2>Choose how to create</h2><p>Make one video or create a batch from Excel.</p></div></div>
              <div className="mode-switch" role="tablist" aria-label="Create mode">
                <button type="button" role="tab" aria-selected={mode === 'single'} disabled={busy} onClick={() => switchMode('single')}><span>Single video</span><small>One yajman</small></button>
                <button type="button" role="tab" aria-selected={mode === 'excel'} disabled={busy} onClick={() => switchMode('excel')}><span>Excel batch</span><small>Multiple yajmans</small></button>
              </div>
            </section>

            <section className="editor-card">
              <div className="section-heading"><span className="step-number">2</span><div><h2>{mode === 'single' ? 'Enter yajman details' : 'Add the spreadsheet list'}</h2><p>{mode === 'single' ? 'Full name is required. Other details are optional.' : 'Map any available columns. Missing details stay blank.'}</p></div></div>
              {mode === 'single' ? <div className="field-grid" aria-label="Yajman details">
                {YAJMAN_FIELDS.map(({ key, label }) => {
                  const error = submitted && key === 'fullName' && !details.fullName.trim();
                  return <label className={`field ${error ? 'field-invalid' : ''}`} data-field={key} key={key} htmlFor={`detail-${key}`}>
                    <span>{label}{key === 'fullName' && <em>Required</em>}</span>
                    <input id={`detail-${key}`} type={key === 'date' ? 'date' : 'text'} inputMode={key === 'number' ? 'tel' : undefined} autoComplete={key === 'number' ? 'tel' : undefined} value={details[key]} disabled={busy} required={key === 'fullName'} aria-invalid={error} aria-describedby={error ? `detail-${key}-error` : undefined} onChange={(event) => { generator.reset(); closePreview(); setDetails((current) => ({ ...current, [key]: event.target.value })); setFormError(null); }} />
                    {error && <small id={`detail-${key}-error`} className="field-error">Enter the yajman’s full name.</small>}
                  </label>;
                })}
              </div> : <ExcelPanel
                excel={excel} mapping={mapping} error={excelError} disabled={busy || rowVideoLoading}
                rowStarters={rowStarters} rowVideoErrors={rowVideoErrors} hasSharedStarter={Boolean(baseFile)}
                individualRowIndex={individualRowIndex} individualPhase={generator.phase}
                individualVideoUrl={generator.videoUrl}
                individualMessage={individualValidationError?.index === individualRowIndex ? individualValidationError.message : generator.message}
                individualFileName={individualFileName}
                onFile={handleExcelPick} onRowVideoChange={handleRowVideoPick} onUseSharedVideo={useSharedVideoForRow}
                onCreateRowVideo={(index) => void handleCreateRowVideo(index)}
                onPreviewRowVideo={() => setPreviewMode('result')}
                onDownloadRowVideo={clearIndividualAfterDownload}
                onMappingChange={(field, column) => {
                  generator.reset(); closePreview(); setIndividualRowIndex(null); setIndividualFileName(''); setIndividualValidationError(null);
                  setMapping((current) => ({ ...current, [field]: column })); setExcelError(null);
                }}
              />}
            </section>

          </div>

          <aside className="preview-column">
            <section className="editor-card">
              <div className="section-heading"><span className="step-number">3</span><div><h2>{mode === 'single' ? 'Choose the starter video' : 'Shared starter video'}</h2><p>{mode === 'excel' ? 'Optional fallback for rows without a separate clip.' : `MP4, up to ${LIMITS.maxVideoBytes / 1024 / 1024} MB and ${LIMITS.maxVideoSeconds} seconds.`}</p></div></div>
              <label className={`upload-drop ${videoError ? 'upload-invalid' : ''}`} htmlFor="video">
                <span className="upload-icon">↑</span><span><strong>{baseFile ? 'Choose a different video' : mode === 'excel' ? 'Select a shared MP4 (optional)' : 'Select an MP4 video'}</strong><small>Rows can use their own clip instead</small></span>
                <input id="video" type="file" accept="video/mp4,.mp4" disabled={busy || rowVideoLoading} onChange={(event) => { const input = event.currentTarget; void handleVideoPick(input.files?.[0]); input.value = ''; }} />
              </label>
              {videoError && <p className="field-error" role="alert">{videoError}</p>}
              {baseFile && <div className="video-file-actions"><span className="selected-file-name">{baseFile.name}</span><button type="button" className="text-button" disabled={busy || videoLoading || rowVideoLoading} onClick={() => setPreviewMode('source')}>Preview starter clip</button><button type="button" className="text-button remove-video" disabled={busy || videoLoading || rowVideoLoading} onClick={() => void handleRemoveVideo()}>Remove</button></div>}
              {meta && <TimeframeInput
                start={startText} end={endText} duration={outputDuration} disabled={busy || rowVideoLoading} error={timeError}
                onStartChange={(value) => { generator.reset(); closePreview(); setIndividualRowIndex(null); setIndividualFileName(''); setIndividualValidationError(null); setStartText(value); setTimeError(null); }}
                onEndChange={(value) => { generator.reset(); closePreview(); setIndividualRowIndex(null); setIndividualFileName(''); setIndividualValidationError(null); setEndText(value); setTimeError(null); }}
              />}
            </section>

            <button type="button" className="primary create-button" onClick={handleGenerate} disabled={busy || videoLoading || rowVideoLoading}>
              {busy ? mode === 'excel' ? 'Creating videos…' : 'Creating your video…' : mode === 'excel' ? excel ? `Create ${excel.rows.length} videos` : 'Create batch' : 'Create video'}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
            {(videoLoading || rowVideoLoading || generator.phase === 'loading' || (generator.phase === 'rendering' && (mode === 'single' || individualRowIndex !== null)) || formError || generator.message) && <div aria-live="polite" className="status">
              {videoLoading && <p className="processing-indicator">Reading the selected video…</p>}
              {rowVideoLoading && <p className="processing-indicator">Reading the row’s starter video…</p>}
              {generator.phase === 'loading' && <p className="processing-indicator">Preparing the on-device video engine. The first load can take a moment.</p>}
              {generator.phase === 'rendering' && (mode === 'single' || individualRowIndex !== null) && <progress max={1} value={generator.progress} aria-label="Render progress" />}
              {(formError || generator.message) && <p className="form-alert" role="alert">{formError ?? generator.message}</p>}
            </div>}

            {mode === 'single' && generator.videoUrl && <section className="result editor-card">
              <div><p className="eyebrow">READY TO DOWNLOAD</p><h2>Your video is ready</h2></div>
              <button type="button" className="secondary" onClick={() => setPreviewMode('result')}>Preview finished video</button>
              <a className="primary" href={generator.videoUrl} download="yajman-video.mp4" onClick={clearGeneratedAfterDownload}>Download video <span>↓</span></a>
            </section>}
          </aside>
        </div>
        {mode === 'excel' && generator.items.length > 0 && <section className="batch-results-wrap">
          <BatchResults
            items={generator.items}
            phase={individualRowIndex !== null ? 'done' : generator.phase}
            progress={individualRowIndex !== null
              ? generator.items.filter((item) => item.status === 'done').length / generator.items.length
              : generator.progress}
            zipUrl={generator.zipUrl}
            onCancel={generator.cancel} onRetryFailed={generator.retryFailed}
            onDownload={clearGeneratedAfterDownload}
          />
        </section>}
        <footer className="privacy-footer">Files stay on this device; nothing is uploaded.</footer>
        {previewMode === 'source' && baseFile && meta && <Modal title="Starter video preview" onClose={closePreview}>
          <VideoPreview file={baseFile} meta={meta} details={sampleDetails} start={startText} end={endText} assetBaseUrl={assetBaseUrl} loading={videoLoading} />
        </Modal>}
        {previewMode === 'result' && generator.videoUrl && (mode === 'single' || individualRowIndex !== null) && <Modal title="Finished video preview" onClose={closePreview}>
          <video className="modal-video" src={generator.videoUrl} controls playsInline autoPlay />
        </Modal>}
    </main>
  );
}
