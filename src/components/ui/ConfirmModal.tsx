import { useState } from 'react';
import { Modal } from './Modal';

export interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  requireText?: string;
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
            disabled={busy || Boolean(required && typed !== required)}
            onClick={confirmation?.onConfirm}
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
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
