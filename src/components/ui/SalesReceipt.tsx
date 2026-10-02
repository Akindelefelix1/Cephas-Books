import { useState } from 'react';
import { Download, Link, Mail, MessageSquare, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
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

function receiptHtml(sale: PosSale, salesperson: string, thermal: boolean, qrCode: string) {
  const context = sale.receipt;
  const rows = sale.items
    .map((item) => {
      const discountPerUnit = Number(item.discount || 0) / Number(item.quantity || 1);
      const soldPrice = Number(item.unitPrice) - discountPerUnit;
      return `<tr><td>${escapeHtml(item.description)}</td><td class="number">${escapeHtml(item.quantity)}</td><td class="number">${money(Number(item.unitPrice), sale.currency)}</td><td class="number">${money(discountPerUnit, sale.currency)}</td><td class="number">${money(soldPrice, sale.currency)}</td><td class="number">${money(Number(item.lineTotal), sale.currency)}</td></tr>`;
    })
    .join('');
  const signature = (label: string, value?: string | null) =>
    value
      ? `<div class="signature"><img src="${escapeHtml(value)}" alt="${label} signature"><span>${label}</span></div>`
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(sale.receiptNumber)}</title><style>
    *{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;max-width:${thermal ? '80mm' : '210mm'};margin:${thermal ? '0' : '20mm auto'};padding:${thermal ? '3mm' : '10mm'}header{text-align:center;padding-bottom:10px;border-bottom:1px dashed #555}h1{font-size:18px;margin:0 0 5px}.logo{max-width:70px;max-height:48px}p{margin:4px 0;color:#475467}.meta{margin-top:8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:6px 3px;border-bottom:1px solid #ddd;text-align:left;font-size:${thermal ? '9px' : '11px'}}th{text-transform:uppercase}.number{text-align:right;white-space:nowrap}.total{margin-top:10px;padding:10px 3px;border-top:2px solid #172033;display:flex;justify-content:space-between;font-size:16px;font-weight:700}.settlement{padding:0 3px;display:flex;justify-content:space-between}.thanks,.policy{text-align:center;margin:14px 0}.qr{display:block;width:90px;height:90px;margin:12px auto}.signatures{display:flex;gap:24px;margin-top:24px}.signature{flex:1;text-align:center}.signature img{width:100%;height:55px;object-fit:contain;border-bottom:1px solid #667085}.signature span{display:block;font-size:10px}@page{size:${thermal ? '80mm auto' : 'A4'};margin:${thermal ? '2mm' : '10mm'}}
    </style></head><body><header>${context?.logoUrl ? `<img class="logo" src="${escapeHtml(context.logoUrl)}">` : ''}<h1>${escapeHtml(context?.organizationName || 'Cephas Books')}</h1><p>${escapeHtml(context?.branchName || '')}</p><p>${escapeHtml(context?.branchAddress || context?.organizationAddress || '')}</p><p>${escapeHtml(context?.branchPhone || context?.organizationPhone || '')}</p><div class="meta"><p>${escapeHtml(sale.receiptNumber)} · ${escapeHtml(new Date(sale.createdAt).toLocaleString())}</p><p>Register: ${escapeHtml(context?.register?.name || '—')}</p><p>Cashier: ${escapeHtml(context?.cashier?.name || salesperson || '—')}</p>${sale.customer ? `<p>Customer: ${escapeHtml(sale.customer.displayName)}</p>` : ''}</div></header><table><thead><tr><th>Item</th><th class="number">Qty</th><th class="number">Price</th><th class="number">Disc.</th><th class="number">Sold at</th><th class="number">Total</th></tr></thead><tbody>${rows}</tbody></table><p class="settlement"><span>Tax</span><strong>${money(Number(sale.taxTotal || 0), sale.currency)}</strong></p>${Number(sale.discountTotal || 0) > 0 ? `<p class="settlement"><span>Discount</span><strong>-${money(Number(sale.discountTotal), sale.currency)}</strong></p>` : ''}<div class="total"><span>Total</span><span>${money(Number(sale.total), sale.currency)}</span></div>${sale.payments.map((payment) => `<p class="settlement"><span>${escapeHtml(payment.method)}${payment.reference ? ` · ${escapeHtml(payment.reference)}` : ''}</span><strong>${money(Number(payment.amount), sale.currency)}</strong></p>`).join('')}<p class="settlement"><span>Paid</span><strong>${money(Number(sale.paidAmount), sale.currency)}</strong></p><p class="settlement"><span>Change</span><strong>${money(Number(sale.changeAmount), sale.currency)}</strong></p><img class="qr" src="${qrCode}"><p class="thanks">Verify: ${escapeHtml(context?.verificationCode || '')}</p><p class="policy">${escapeHtml(context?.returnPolicy || '')}</p><p class="thanks">Thank you for your business.</p><div class="signatures">${signature('Customer', sale.customerSignature)}${signature('Sales manager', sale.salesManagerSignature)}</div></body></html>`;
}

export function SalesReceipt({
  sale,
  salesperson = '',
  onSaleChange,
  canReprint = true,
  historical = false,
}: {
  sale: PosSale;
  salesperson?: string;
  onSaleChange: (sale: PosSale) => void;
  canReprint?: boolean;
  historical?: boolean;
}) {
  const [customerSignature, setCustomerSignature] = useState<string | null>(
    sale.customerSignature ?? null,
  );
  const [salesManagerSignature, setSalesManagerSignature] = useState<string | null>(
    sale.salesManagerSignature ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const prepare = async () => {
    if (historical) {
      if (!canReprint) throw new Error('You do not have permission to reprint this receipt.');
      await posApi.recordReprint(sale.id);
    }
    const updatedSale = await posApi.updateReceiptSignatures(sale.id, {
      customerSignature,
      salesManagerSignature,
    });
    onSaleChange(updatedSale);
    return updatedSale;
  };
  const print = async (thermal: boolean) => {
    const printWindow = window.open('', '_blank', 'width=760,height=800');
    if (!printWindow) {
      setError('Allow pop-ups to print or download this receipt.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updatedSale = await prepare();
      const qrCode = await QRCode.toDataURL(updatedSale.receipt?.digitalUrl || updatedSale.id);
      printWindow.document.open();
      printWindow.document.write(receiptHtml(updatedSale, salesperson, thermal, qrCode));
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
  const downloadPdf = async () => {
    setBusy(true);
    setError('');
    try {
      const updatedSale = await prepare();
      const receipt = updatedSale.receipt;
      const qrCode = await QRCode.toDataURL(receipt?.digitalUrl || updatedSale.id);
      const document = new jsPDF({ unit: 'mm', format: 'a4' });
      let y = 16;
      document.setFontSize(18);
      document.text(receipt?.organizationName || 'Cephas Books', 105, y, { align: 'center' });
      document.setFontSize(10);
      y += 7;
      [receipt?.branchName, receipt?.branchAddress, receipt?.branchPhone].filter(Boolean).forEach((line) => {
        document.text(String(line), 105, y, { align: 'center' }); y += 5;
      });
      y += 4;
      document.text(`Receipt: ${updatedSale.receiptNumber}`, 14, y);
      document.text(`Date: ${new Date(updatedSale.createdAt).toLocaleString()}`, 110, y);
      y += 6;
      document.text(`Register: ${receipt?.register?.name || '—'}`, 14, y);
      document.text(`Cashier: ${receipt?.cashier?.name || salesperson || '—'}`, 110, y);
      y += 9;
      updatedSale.items.forEach((item) => {
        const perUnitDiscount = Number(item.discount || 0) / Number(item.quantity || 1);
        document.text(`${item.description} × ${item.quantity}`, 14, y);
        document.text(money(Number(item.lineTotal), updatedSale.currency), 196, y, { align: 'right' });
        if (perUnitDiscount > 0) {
          y += 4;
          document.setTextColor(20, 130, 70);
          document.text(`Discount ${money(perUnitDiscount, updatedSale.currency)} per unit`, 18, y);
          document.setTextColor(0, 0, 0);
        }
        y += 7;
        if (y > 260) { document.addPage(); y = 16; }
      });
      document.line(14, y, 196, y); y += 7;
      document.text(`Tax: ${money(Number(updatedSale.taxTotal || 0), updatedSale.currency)}`, 196, y, { align: 'right' }); y += 6;
      document.setFontSize(14);
      document.text(`Total: ${money(Number(updatedSale.total), updatedSale.currency)}`, 196, y, { align: 'right' });
      document.addImage(qrCode, 'PNG', 14, y - 4, 28, 28);
      document.setFontSize(9);
      document.text(`Verification: ${receipt?.verificationCode || ''}`, 14, y + 29);
      document.text(receipt?.returnPolicy || '', 105, y + 38, { align: 'center', maxWidth: 170 });
      document.save(`${updatedSale.receiptNumber}.pdf`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to download receipt PDF.');
    } finally {
      setBusy(false);
    }
  };
  const deliver = async (method: 'email' | 'sms') => {
    setBusy(true); setError('');
    try {
      if (historical && !canReprint) throw new Error('You do not have permission to deliver this receipt.');
      if (method === 'email') await posApi.emailReceipt(sale.id);
      else await posApi.smsReceipt(sale.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to send ${method} receipt.`);
    } finally { setBusy(false); }
  };
  const copyDigitalReceipt = async () => {
    setBusy(true); setError('');
    try {
      const url = sale.receipt?.digitalUrl || `${window.location.origin}/receipt/${sale.id}`;
      await navigator.clipboard.writeText(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to copy the digital receipt link.');
    } finally { setBusy(false); }
  };

  const organizationName = sale.receipt?.organizationName || 'Cephas Books';
  const branchAddress = [sale.receipt?.branchAddress, sale.receipt?.branchPhone, sale.receipt?.organizationAddress]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="receipt-card">
      <div className="receipt-card__heading">
        {sale.receipt?.logoUrl ? (
          <img src={sale.receipt.logoUrl} alt={organizationName} style={{ maxHeight: 48, maxWidth: 90, objectFit: 'contain' }} />
        ) : null}
        <strong>{organizationName}</strong>
        <small>{sale.receiptNumber}</small>
        {sale.receipt?.branchName && <small>{sale.receipt.branchName}</small>}
        {branchAddress && <small>{branchAddress}</small>}
        {sale.receipt?.register?.name && <small>Register: {sale.receipt.register.name}</small>}
        {sale.receipt?.cashier?.name && <small>Cashier: {sale.receipt.cashier.name}</small>}
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
              <th className="is-right">Original</th>
              <th className="is-right">Discount / unit</th>
              <th className="is-right">Sold at</th>
              <th className="is-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => {
              const discountPerUnit = Number(item.discount || 0) / Number(item.quantity || 1);
              return <tr key={`${item.description}-${index}`}>
                <td>{item.description}</td>
                <td className="is-right">{item.quantity}</td>
                <td className="is-right">{money(Number(item.unitPrice), sale.currency)}</td>
                <td className="is-right">{money(discountPerUnit, sale.currency)}</td>
                <td className="is-right">
                  {money(Number(item.unitPrice) - discountPerUnit, sale.currency)}
                </td>
                <td className="is-right">{money(Number(item.lineTotal), sale.currency)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="receipt-card__settlement">
        <span>Subtotal</span>
        <strong>{money(Number(sale.subtotal ?? sale.total), sale.currency)}</strong>
      </div>
      {Number(sale.taxTotal || 0) > 0 && (
        <div className="receipt-card__settlement">
          <span>Tax</span>
          <strong>{money(Number(sale.taxTotal), sale.currency)}</strong>
        </div>
      )}
      {Number(sale.discountTotal || 0) > 0 && (
        <div className="receipt-card__settlement">
          <span>Discount</span>
          <strong>−{money(Number(sale.discountTotal), sale.currency)}</strong>
        </div>
      )}
      <div className="receipt-card__total">
        <span>Total</span>
        <strong>{money(Number(sale.total), sale.currency)}</strong>
      </div>
      {sale.payments.length > 0 && (
        <div className="receipt-card__settlement" style={{ display: 'block' }}>
          {sale.payments.map((payment) => (
            <div key={`${payment.method}-${payment.amount}-${payment.reference ?? 'no-ref'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</span>
              <strong>{money(Number(payment.amount), sale.currency)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="receipt-card__settlement">
        <span>Paid</span>
        <strong>{money(Number(sale.paidAmount), sale.currency)}</strong>
        <span>Change</span>
        <strong>{money(Number(sale.changeAmount), sale.currency)}</strong>
      </div>
      {sale.receipt?.verificationCode && (
        <div className="receipt-card__settlement" style={{ display: 'block' }}>
          <span>Verification</span>
          <strong>{sale.receipt.verificationCode}</strong>
        </div>
      )}
      {sale.receipt?.digitalUrl && (
        <div className="receipt-card__settlement" style={{ display: 'block' }}>
          <span>Digital receipt</span>
          <strong>{sale.receipt.digitalUrl}</strong>
        </div>
      )}
      {sale.receipt?.returnPolicy && (
        <div className="receipt-card__settlement" style={{ display: 'block' }}>
          <span>Return policy</span>
          <strong>{sale.receipt.returnPolicy}</strong>
        </div>
      )}
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
        <button className="button button--secondary" onClick={() => void print(true)} disabled={busy}>
          <Printer size={16} /> {busy ? 'Saving…' : 'Print thermal'}
        </button>
        <button className="button" onClick={() => void downloadPdf()} disabled={busy}>
          <Download size={16} /> {busy ? 'Saving…' : 'Download PDF'}
        </button>
      </div>
      <div className="receipt-card__actions">
        <button className="button button--secondary" onClick={() => void deliver('email')} disabled={busy}>
          <Mail size={16} /> Email
        </button>
        <button className="button button--secondary" onClick={() => void deliver('sms')} disabled={busy}>
          <MessageSquare size={16} /> SMS
        </button>
        <button className="button button--secondary" onClick={() => void copyDigitalReceipt()} disabled={busy}>
          <Link size={16} /> Copy link
        </button>
      </div>
    </div>
  );
}
