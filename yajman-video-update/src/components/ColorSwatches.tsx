import { SWATCHES } from '../services/captionStyle';

interface Props {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatches({ label, value, onChange }: Props) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="swatches" role="group" aria-label={label}>
        {SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ backgroundColor: color }}
            aria-label={color}
            aria-pressed={value.toLowerCase() === color}
            onClick={() => onChange(color)}
          />
        ))}
        <input
          type="color"
          className="swatch-custom"
          aria-label={`${label}, custom`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
