export interface AppDialogOptions {
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface AppDialogRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (confirmed: boolean) => void;
}

export function appDialog(
  title: string,
  message: string,
  options?: AppDialogOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<AppDialogRequest>('cephas:app-dialog', {
      detail: { title, message, ...options, resolve },
    }));
  });
}
