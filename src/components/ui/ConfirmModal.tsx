import { useState } from 'react';
import { Modal } from './Modal';

export interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: (value?: string) => void;
  requireText?: string;
  input?: { label: string; placeholder?: string; maxLength?: number };
}

export function ConfirmModal({
  confirmation,
  busy,
  error,
  onClose,
}: {
  confirmation: Confirmation | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const required = confirmation?.requireText;
  return (
    <Modal
      open={Boolean(confirmation)}
      onClose={busy ? () => undefined : onClose}
      title={confirmation?.title ?? 'Confirm action'}
      subtitle={confirmation?.message}
      footer={
        <>
          <button className="button button--secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button--danger"
            disabled={
              busy ||
              Boolean(required && typed !== required) ||
              Boolean(confirmation?.input && !typed.trim())
            }
            onClick={() => confirmation?.onConfirm(typed.trim())}
          >
            {busy ? 'Working…' : confirmation?.confirmLabel}
          </button>
        </>
      }
    >
      {required && (
        <label className="full">
          Type <strong>{required}</strong> to continue
          <input
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {confirmation?.input && (
        <label className="full">
          {confirmation.input.label}
          <textarea
            autoFocus
            value={typed}
            placeholder={confirmation.input.placeholder}
            maxLength={confirmation.input.maxLength ?? 500}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
