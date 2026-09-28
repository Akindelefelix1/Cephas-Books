import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { posApi, type PosSale } from '@/services/pos';
import { getDefaultCurrency } from '@/utils/currency';

const money = (value: number, currency = getDefaultCurrency()) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

function receiptHtml(sale: PosSale, salesperson: string, download: boolean) {
  const rows = sale.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${money(Number(item.unitPrice), sale.currency)}</td><td class="number">${money(Number(item.lineTotal), sale.currency)}</td></tr>`,
    )
    .join('');
  const signature = (label: string, value?: string | null) =>
    value
      ? `<div class="signature"><img src="${escapeHtml(value)}" alt="${label} signature"><span>${label}</span></div>`
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${download ? 'Download' : 'Print'} ${escapeHtml(sale.receiptNumber)}</title><style>
    *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172033;max-width:720px;margin:32px auto;padding:0 16px}header{text-align:center;padding-bottom:16px;border-bottom:1px dashed #dce2ec}h1{font-size:22px;margin:0 0 8px}p{margin:5px 0;color:#667085}.meta{margin-top:12px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:left}th{font-size:12px;color:#667085;text-transform:uppercase}.number{text-align:right;white-space:nowrap}.total{margin:14px 0 0;padding:12px 8px;border-top:2px solid #172033;display:flex;justify-content:space-between;font-size:18px;font-weight:700}.settlement{padding:0 8px;display:flex;justify-content:space-between}.thanks{text-align:center;margin:24px 0}.signatures{display:flex;gap:36px;margin-top:32px}.signature{flex:1;min-width:0;text-align:center}.signature img{display:block;width:100%;height:70px;object-fit:contain;border-bottom:1px solid #667085}.signature span{display:block;margin-top:7px;color:#667085;font-size:12px}@media print{body{margin:0 auto;padding:0}button{display:none}}
    </style></head><body><header><h1>Cephas Books</h1><p>Sales receipt</p><div class="meta"><p>${escapeHtml(sale.receiptNumber)} · ${escapeHtml(new Date(sale.createdAt).toLocaleString())}</p>${sale.customer ? `<p>Customer: ${escapeHtml(sale.customer.displayName)}</p>` : ''}<p>Salesperson: ${escapeHtml(salesperson || '—')}</p></div></header><table><thead><tr><th>Item</th><th class="number">Quantity</th><th class="number">Unit price</th><th class="number">Total price</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>Total</span><span>${money(Number(sale.total), sale.currency)}</span></div><p class="settlement"><span>Paid</span><strong>${money(Number(sale.paidAmount), sale.currency)}</strong></p><p class="settlement"><span>Change</span><strong>${money(Number(sale.changeAmount), sale.currency)}</strong></p><p class="thanks">Thank you for your business.</p><div class="signatures">${signature('Customer', sale.customerSignature)}${signature('Sales manager', sale.salesManagerSignature)}</div></body></html>`;
}

export function SalesReceipt({
  sale,
  salesperson = '',
  onSaleChange,
}: {
  sale: PosSale;
  salesperson?: string;
  onSaleChange: (sale: PosSale) => void;
}) {
  const [customerSignature, setCustomerSignature] = useState<string | null>(
    sale.customerSignature ?? null,
  );
  const [salesManagerSignature, setSalesManagerSignature] = useState<string | null>(
    sale.salesManagerSignature ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const print = async (download: boolean) => {
    const printWindow = window.open('', '_blank', 'width=760,height=800');
    if (!printWindow) {
      setError('Allow pop-ups to print or download this receipt.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updatedSale = await posApi.updateReceiptSignatures(sale.id, {
        customerSignature,
        salesManagerSignature,
      });
      onSaleChange(updatedSale);
      printWindow.document.open();
      printWindow.document.write(receiptHtml(updatedSale, salesperson, download));
      printWindow.document.close();
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    } catch (caught) {
      printWindow.close();
      setError(caught instanceof Error ? caught.message : 'Unable to save receipt signatures.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="receipt-card">
      <div className="receipt-card__heading">
        <strong>Cephas Books</strong>
        <small>{sale.receiptNumber}</small>
        <small>{new Date(sale.createdAt).toLocaleString()}</small>
        {sale.customer && <small>Customer: {sale.customer.displayName}</small>}
        {salesperson && <small>Salesperson: {salesperson}</small>}
      </div>
      <div className="receipt-card__table-wrap">
        <table className="receipt-card__table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="is-right">Quantity</th>
              <th className="is-right">Unit price</th>
              <th className="is-right">Total price</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={`${item.description}-${index}`}>
                <td>{item.description}</td>
                <td className="is-right">{item.quantity}</td>
                <td className="is-right">{money(Number(item.unitPrice), sale.currency)}</td>
                <td className="is-right">{money(Number(item.lineTotal), sale.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="receipt-card__total">
        <span>Total</span>
        <strong>{money(Number(sale.total), sale.currency)}</strong>
      </div>
      <div className="receipt-card__settlement">
        <span>Paid</span>
        <strong>{money(Number(sale.paidAmount), sale.currency)}</strong>
        <span>Change</span>
        <strong>{money(Number(sale.changeAmount), sale.currency)}</strong>
      </div>
      <div className="receipt-card__signatures">
        <SignaturePad
          label="Customer signature (optional)"
          value={customerSignature}
          onChange={setCustomerSignature}
        />
        <SignaturePad
          label="Sales manager signature (optional)"
          value={salesManagerSignature}
          onChange={setSalesManagerSignature}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="receipt-card__actions">
        <button
          className="button button--secondary"
          onClick={() => void print(false)}
          disabled={busy}
        >
          <Printer size={16} /> {busy ? 'Saving…' : 'Print'}
        </button>
        <button className="button" onClick={() => void print(true)} disabled={busy}>
          <Download size={16} /> {busy ? 'Saving…' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
