type NotificationTone = 'success' | 'error';

function showNotification(message: string, tone: NotificationTone) {
  document.querySelectorAll('.action-toast').forEach((notification) => notification.remove());
  const toast = document.createElement('div');
  toast.className = `action-toast action-toast--${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');

  const content = document.createElement('span');
  const title = document.createElement('strong');
  const detail = document.createElement('small');
  title.textContent = tone === 'error' ? 'Something went wrong' : 'Success';
  detail.textContent = message;
  content.append(title, detail);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '\u00d7';

  const remove = () => {
    window.clearTimeout(removalTimer);
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 200);
  };
  dismiss.addEventListener('click', remove);
  toast.append(content, dismiss);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  const removalTimer = window.setTimeout(remove, tone === 'error' ? 7000 : 3500);
}

export function confirmAction(message: string) {
  showNotification(message, 'success');
}

export function notifyError(message: string) {
  showNotification(message, 'error');
}

export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  confirmAction(`${filename} downloaded`);
}
