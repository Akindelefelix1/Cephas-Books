import { useState } from 'react';

const presets = [0, 7, 14, 30, 60];

export function PaymentTermsField({ name, value = 30, title = 'Payment terms' }: {
  name: string;
  value?: number;
  title?: string;
}) {
  const isPreset = presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [days, setDays] = useState(value);
  return (
    <label className="payment-terms-field">
      {title}
      <select
        aria-label={title}
        value={custom ? 'custom' : String(days)}
        onChange={(event) => {
          if (event.target.value === 'custom') setCustom(true);
          else {
            setCustom(false);
            setDays(Number(event.target.value));
          }
        }}
      >
        <option value="0">Due on receipt</option>
        <option value="7">7 days</option>
        <option value="14">14 days</option>
        <option value="30">30 days</option>
        <option value="60">60 days</option>
        <option value="custom">Custom</option>
      </select>
      {custom && (
        <input
          type="number"
          aria-label="Custom payment period in days"
          min="1"
          max="3650"
          step="1"
          required
          value={days || ''}
          onChange={(event) => setDays(Number(event.target.value))}
          placeholder="Days (1–3650)"
        />
      )}
      <input type="hidden" name={name} value={days} />
      <small className="field-hint">Invoice or bill due dates use calendar days from the issue date.</small>
    </label>
  );
}
