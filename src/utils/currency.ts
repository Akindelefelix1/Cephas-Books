const KEY = 'cephas:base-currency';

export function getDefaultCurrency(): string {
  return localStorage.getItem(KEY) || 'NGN';
}

export function setDefaultCurrency(currency: string): void {
  localStorage.setItem(KEY, currency.toUpperCase());
  window.dispatchEvent(
    new CustomEvent('cephas:currency-changed', { detail: currency.toUpperCase() }),
  );
}
