import type { BatchItem } from '../services/batchRunner';
import type { Phase } from '../hooks/useVideoGenerator';

interface Props {
  items: BatchItem[];
  phase: Phase;
  progress: number;
  zipUrl: string | null;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDownload: () => void;
}

const STATUS_LABEL: Record<BatchItem['status'], string> = {
  pending: 'Waiting',
  rendering: 'Rendering',
  done: 'Done',
  failed: 'Failed',
};

export function BatchResults({ items, phase, progress, zipUrl, onCancel, onRetryFailed, onDownload }: Props) {
  const done = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const remaining = items.length - done;
  const running = phase === 'loading' || phase === 'rendering';

  return (
    <section className="result">
      <p><strong>{done} of {items.length} videos finished</strong> · {remaining} remaining{failed > 0 ? ` · ${failed} failed` : ''}</p>
      <progress max={1} value={progress} aria-label="Batch progress" />

      <details className="batch-details">
        <summary>View individual video status</summary>
        <ul className="plain-list status-list">
          {items.map((item) => (
            <li key={item.index} className={`status-${item.status}`}>
              <span className="batch-file-name">{item.fileName}</span>
              <span className="batch-item-status">
                {STATUS_LABEL[item.status]}
                {item.error ? `: ${item.error}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="actions">
        {running && (
          <button type="button" className="secondary" onClick={onCancel}>
            Stop after this video
          </button>
        )}
        {!running && failed > 0 && (
          <button type="button" className="secondary" onClick={onRetryFailed}>
            Retry failed
          </button>
        )}
        {!running && zipUrl && (
          <a className="primary" href={zipUrl} download="yajman-videos.zip" onClick={onDownload}>
            Download ZIP
          </a>
        )}
      </div>
    </section>
  );
}
