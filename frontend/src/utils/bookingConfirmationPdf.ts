export type BookingConfirmationPayload = {
  bookingReference: string;
  transferReference: string;
  submittedAt?: string;
  paymentDate: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  guestCount: number;
  eventTitle: string;
  eventDate?: string;
  venue: string;
  packageName: string;
  seating: string;
  bankName: string;
  accountHolder: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  items?: Array<{ name?: string; quantity?: number; unitPrice?: number; totalPrice?: number }>;
  notes?: string;
};

const safeDate = (value?: string, includeTime = false) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return includeTime
    ? date.toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
    : date.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
};

const logoDataUrl = () => new Promise<string>((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || 160;
    canvas.height = image.naturalHeight || 160;
    const context = canvas.getContext('2d');
    if (!context) return reject(new Error('Logo canvas unavailable'));
    context.drawImage(image, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  };
  image.onerror = () => reject(new Error('Logo unavailable'));
  image.src = '/logo-160.png';
});

export const downloadBookingConfirmationPdf = async (data: BookingConfirmationPayload) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  const purple: [number,number,number] = [109, 40, 217];
  const navy: [number,number,number] = [5, 8, 23];
  const slate: [number,number,number] = [71, 85, 105];
  const money = (value:number) => new Intl.NumberFormat('en-US', { style:'currency', currency:data.currency || 'USD' }).format(Number(value || 0));

  doc.setFillColor(...navy);
  doc.rect(0, 0, width, 48, 'F');
  try { doc.addImage(await logoDataUrl(), 'PNG', margin, 8, 27, 27); } catch { /* Text branding remains if the image cannot load. */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('HOODBOY ENTERTAINMENT', 48, 17);
  doc.setFontSize(9);
  doc.setTextColor(196, 181, 253);
  doc.text('THE LNK UP - PAYMENT SUBMISSION CONFIRMATION', 48, 24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Issued ${safeDate(data.submittedAt || new Date().toISOString(), true)}`, 48, 31);

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, 56, width - margin * 2, 25, 3, 3, 'FD');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYMENT RECEIPT SUBMITTED - PENDING VERIFICATION', margin + 6, 66);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('This document confirms submission only. The reservation becomes final after payment approval.', margin + 6, 73);

  const tableBase: any = {
    theme: 'plain',
    margin: { left:margin, right:margin },
    styles: { font:'helvetica', fontSize:9, cellPadding:3.2, textColor:navy, lineColor:[226,232,240], lineWidth:0.15 },
    columnStyles: { 0:{ cellWidth:48, fontStyle:'bold', textColor:slate, fillColor:[248,250,252] }, 1:{ cellWidth:'auto' } },
    headStyles: { fillColor:purple, textColor:[255,255,255], fontStyle:'bold', fontSize:9.5 },
  };

  autoTable(doc, {
    ...tableBase,
    startY: 88,
    head: [['Confirmation details', '']],
    body: [
      ['Booking reference', data.bookingReference || '-'],
      ['Transfer reference', data.transferReference || '-'],
      ['Payment date', safeDate(data.paymentDate)],
      ['Submission status', data.status || 'Pending payment verification'],
    ],
  });

  let y = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Customer and event', '']],
    body: [
      ['Customer', data.customerName || '-'],
      ['Email', data.email || '-'],
      ['Contact number', data.phone || '-'],
      ['Guests', String(data.guestCount || 1)],
      ['Event', data.eventTitle || '-'],
      ['Event date', safeDate(data.eventDate, true)],
      ['Venue', data.venue || '-'],
      ['Package', data.packageName || '-'],
      ['Seating', data.seating || '-'],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  if (y > 225) { doc.addPage(); y = 18; }
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Payment summary', '']],
    body: [
      ['Receiving bank', data.bankName || '-'],
      ['Account holder', data.accountHolder || '-'],
      ['Payment method', 'Bank transfer'],
      ['Subtotal', money(data.subtotal)],
      ['Tax', money(data.taxAmount)],
      ['Service fee', money(data.serviceFeeAmount)],
      ['Total submitted', money(data.totalAmount)],
    ],
    didParseCell: (hook:any) => {
      if (hook.section === 'body' && hook.row.index === 6) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.textColor = purple;
        hook.cell.styles.fontSize = 10.5;
      }
    },
  });

  if (data.items?.length) {
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 235) { doc.addPage(); y = 18; }
    autoTable(doc, {
      margin: { left:margin, right:margin }, startY:y, theme:'grid',
      head: [['Included item', 'Qty', 'Unit price', 'Total']],
      body: data.items.map(item => [item.name || 'Package item', item.quantity || 1, money(item.unitPrice || 0), money(item.totalPrice || 0)]),
      styles: { font:'helvetica', fontSize:8.5, cellPadding:3, lineColor:[226,232,240], lineWidth:0.15 },
      headStyles: { fillColor:purple, textColor:[255,255,255] },
      columnStyles: { 0:{ cellWidth:85 }, 1:{ halign:'center' }, 2:{ halign:'right' }, 3:{ halign:'right', fontStyle:'bold' } },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, height - 18, width - margin, height - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...slate);
    doc.text('Keep this confirmation for your records. Contact HoodBoy Entertainment with your booking reference.', margin, height - 11);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 11, { align:'right' });
  }

  const cleanReference = (data.bookingReference || 'Linkup').replace(/[^A-Z0-9-]/gi, '_');
  doc.save(`HoodBoy_Linkup_Confirmation_${cleanReference}.pdf`);
};
