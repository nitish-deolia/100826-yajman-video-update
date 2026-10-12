import { useEffect, useState } from 'react';
import type { ExcelData } from '../utils/excel';
import type { Phase, RowStarterVideo } from '../hooks/useVideoGenerator';
import { mapExcelRow, YAJMAN_FIELDS, type FieldKey, type FieldMap } from '../utils/yajmanExcel';
import { LIMITS } from '../constants';

const ROWS_PER_PAGE = 10;

interface Props {
  excel: ExcelData | null;
  mapping: FieldMap;
  error: string | null;
  disabled?: boolean;
  rowStarters: ReadonlyMap<number, RowStarterVideo>;
  rowVideoErrors: ReadonlyMap<number, string>;
  hasSharedStarter: boolean;
  individualRowIndex: number | null;
  individualPhase: Phase;
  individualVideoUrl: string | null;
  individualMessage: string | null;
  individualFileName: string;
  onFile: (file: File | undefined) => void;
  onMappingChange: (field: FieldKey, column: string) => void;
  onRowVideoChange: (index: number, file: File | undefined) => void;
  onUseSharedVideo: (index: number) => void;
  onCreateRowVideo: (index: number) => void;
  onPreviewRowVideo: () => void;
  onDownloadRowVideo: () => void;
}

export function ExcelPanel({
  excel,
  mapping,
  error,
  disabled,
  rowStarters,
  rowVideoErrors,
  hasSharedStarter,
  individualRowIndex,
  individualPhase,
  individualVideoUrl,
  individualMessage,
  individualFileName,
  onFile,
  onMappingChange,
  onRowVideoChange,
  onUseSharedVideo,
  onCreateRowVideo,
  onPreviewRowVideo,
  onDownloadRowVideo,
}: Props) {
  const [page, setPage] = useState(0);
  const rowCount = excel?.rows.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE));
  const firstRow = page * ROWS_PER_PAGE;
  const visibleRows = excel?.rows.slice(firstRow, firstRow + ROWS_PER_PAGE) ?? [];

  useEffect(() => {
    setPage(0);
  }, [excel]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  return (
    <div className="stack">
      <div className="excel-upload">
        <span className="excel-upload-label">Users Excel file</span>
        <label className="upload-drop excel-upload-drop" htmlFor="excel">
          <span className="upload-icon">▦</span>
          <span><strong>{excel ? 'Choose a different spreadsheet' : 'Select a spreadsheet'}</strong><small>.xlsx or .numbers · up to {LIMITS.maxBatchRows} rows</small></span>
          <input id="excel" type="file" accept=".xlsx,.numbers" disabled={disabled} onChange={(event) => { const input = event.currentTarget; onFile(input.files?.[0]); input.value = ''; }} />
        </label>
        <p className="hint">Choose a column for each detail. Unmapped or missing columns are left blank.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
      {excel && <>
        <p className="excel-summary">{excel.rows.length} people loaded from {excel.headers.length} columns.</p>
        <div className="field-map">
          {YAJMAN_FIELDS.map(({ key, label }) => (
            <label key={key} className="map-row">
              <span>{label}</span>
              <select value={mapping[key]} disabled={disabled} onChange={(e) => onMappingChange(key, e.target.value)}>
                <option value="">Leave blank</option>
                {excel.headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div>
          <p className="sample-title">Sample row preview</p>
          <ul className="plain-list">
            {YAJMAN_FIELDS.map(({ key, label }) => <li key={key}><strong>{label}:</strong> {excel.rows[0]?.[mapping[key]] || '(blank)'}</li>)}
          </ul>
        </div>
        <section className="row-starter-section" aria-labelledby="row-starter-title">
          <div className="row-starter-heading">
            <div>
              <h3 id="row-starter-title">Starter video for each row</h3>
              <p>Choose a separate clip when needed, then create a video for that row.</p>
            </div>
            <span className="row-starter-count">{rowStarters.size} separate clips</span>
          </div>
          {pageCount > 1 && <nav className="row-page-controls" aria-label="Spreadsheet row pages">
            <span>Rows {firstRow + 1}–{Math.min(firstRow + ROWS_PER_PAGE, rowCount)} of {rowCount}</span>
            <div>
              <button type="button" className="secondary" disabled={disabled || page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button>
              <span className="row-page-number">Page {page + 1} of {pageCount}</span>
              <button type="button" className="secondary" disabled={disabled || page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button>
            </div>
          </nav>}
          <div className="row-starter-list" role="list" aria-label="Starter videos by spreadsheet row">
            {visibleRows.map((row, pageIndex) => {
              const index = firstRow + pageIndex;
              const starter = rowStarters.get(index);
              const rowName = mapExcelRow(row, mapping).fullName.trim() || `Spreadsheet row ${index + 1}`;
              const errorId = `row-video-error-${index}`;
              const rowIsActive = individualRowIndex === index;
              const rowIsRendering = rowIsActive && (individualPhase === 'loading' || individualPhase === 'rendering');
              const rowHasVideo = rowIsActive && individualPhase === 'done' && Boolean(individualVideoUrl);
              const rowHasError = rowIsActive && Boolean(individualMessage) && !rowIsRendering && !rowHasVideo;
              return (
                <div className={`row-starter-item${rowVideoErrors.has(index) || rowHasError ? ' row-starter-invalid' : ''}`} role="listitem" key={index}>
                  <div className="row-starter-person">
                    <span className="row-starter-number">{index + 1}</span>
                    <div className="row-starter-person-copy">
                      <strong>{rowName}</strong>
                      <small>{starter?.baseFile.name ?? (hasSharedStarter ? 'Using shared starter' : 'Needs a starter video')}</small>
                    </div>
                  </div>
                  <div className="row-starter-actions">
                    <label className="row-video-pick" htmlFor={`row-video-${index}`} aria-describedby={rowVideoErrors.has(index) ? errorId : undefined}>
                      {starter ? 'Replace clip' : 'Choose clip'}
                      <input
                        id={`row-video-${index}`}
                        type="file"
                        accept="video/mp4,.mp4"
                        disabled={disabled}
                        aria-invalid={rowVideoErrors.has(index)}
                        onChange={(event) => {
                          const input = event.currentTarget;
                          onRowVideoChange(index, input.files?.[0]);
                          input.value = '';
                        }}
                      />
                    </label>
                    {starter && <button className="text-button use-shared-button" type="button" disabled={disabled} onClick={() => onUseSharedVideo(index)}>{hasSharedStarter ? 'Use shared' : 'Remove clip'}</button>}
                    <button className="row-create-button" type="button" disabled={disabled} onClick={() => onCreateRowVideo(index)}>
                      {rowIsRendering ? 'Creating…' : rowHasVideo ? 'Create again' : 'Create video'}
                    </button>
                  </div>
                  {rowHasVideo && <div className="row-video-ready" role="status">
                    <span>Video ready</span>
                    <button type="button" className="text-button" onClick={onPreviewRowVideo}>Preview</button>
                    <a className="row-download-button" href={individualVideoUrl ?? undefined} download={individualFileName || 'yajman-video.mp4'} onClick={onDownloadRowVideo}>Download</a>
                  </div>}
                  {rowVideoErrors.has(index) && <p className="field-error row-video-error" id={errorId} role="alert">{rowVideoErrors.get(index)}</p>}
                  {rowHasError && <p className="field-error row-video-error" role="alert">{individualMessage}</p>}
                </div>
              );
            })}
          </div>
        </section>
      </>}
    </div>
  );
}

export type { FieldKey, FieldMap };
