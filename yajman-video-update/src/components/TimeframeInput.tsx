interface Props {
  start: string;
  end: string;
  duration: number;
  disabled?: boolean;
  error?: string | null;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function TimeframeInput({ start, end, duration, disabled, error, onStartChange, onEndChange }: Props) {
  return (
    <fieldset className="timeframe-panel" disabled={disabled}>
      <legend>Footer timing</legend>
      <div className="timeframe-fields">
        <label className="field" htmlFor="start">
          <span>Show from</span>
          <input
            id="start"
            type="number"
            min={0}
            max={duration}
            step="any"
            value={start}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'timeframe-error' : undefined}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </label>
        <label className="field" htmlFor="end">
          <span>Hide after</span>
          <input
            id="end"
            type="number"
            min={0}
            max={duration}
            step="any"
            value={end}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'timeframe-error' : undefined}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </label>
      </div>
      {error && <small id="timeframe-error" className="field-error" role="alert">{error}</small>}
      <p className="hint">Finished video duration: {duration.toFixed(1)} seconds. The footer can stay visible through the appended video.</p>
    </fieldset>
  );
}
