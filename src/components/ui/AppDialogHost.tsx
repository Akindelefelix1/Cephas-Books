import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { type AppDialogRequest } from '@/utils/appDialogs';

export function AppDialogHost() {
  const [dialog, setDialog] = useState<AppDialogRequest | null>(null);

  useEffect(() => {
    const receive = (event: Event) => {
      const request = (event as CustomEvent<AppDialogRequest>).detail;
      setDialog((previous) => {
        previous?.resolve(false);
        return request;
      });
    };
    window.addEventListener('cephas:app-dialog', receive);
    return () => window.removeEventListener('cephas:app-dialog', receive);
  }, []);

  const close = (confirmed: boolean) => {
    const active = dialog;
    setDialog(null);
    active?.resolve(confirmed);
  };

  return (
    <Modal
      open={Boolean(dialog)}
      title={dialog?.title ?? ''}
      subtitle={dialog?.message}
      onClose={() => close(false)}
      footer={
        <>
          {dialog?.cancelLabel && (
            <button className="button button--secondary" onClick={() => close(false)}>
              {dialog.cancelLabel}
            </button>
          )}
          <button className="button" onClick={() => close(true)}>
            {dialog?.confirmLabel ?? 'Close'}
          </button>
        </>
      }
    />
  );
}
