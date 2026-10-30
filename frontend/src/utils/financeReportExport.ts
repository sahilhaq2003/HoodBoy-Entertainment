export interface FinanceReportTransaction {
  _id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description?: string;
  amount: number;
  paymentStatus?: string;
  invoiceNumber?: string;
  counterparty?: string;
  department?: string;
  artist?: { name?: string; stageName?: string; artistName?: string };
  project?: { name?: string };
  release?: { title?: string };
}

export interface FinanceReportBudget {
  name: string;
  year: number;
  quarter?: number;
  totalBudget: number;
  status: string;
  department?: string;
  items?: Array<{ budgeted?: number; spent?: number }>;
}

export interface FinanceReportPayload {
  year: number;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    pendingCount: number;
    monthlyBreakdown: Array<{ name: string; revenue: number; expenses: number; profit: number }>;
    quarterBreakdown: Array<{ quarter: number; revenue: number; expenses: number; profit: number }>;
    topArtists: Array<{ name: string; total: number }>;
    topExpenses: Array<{ _id: string; total: number }>;
  };
  categories: Array<{ category: string; type: string; total: number; percentage: number; count: number }>;
  cashFlow: Array<{ month: string; income: number; expenses: number; balance: number }>;
  transactions: FinanceReportTransaction[];
  budgets: FinanceReportBudget[];
  categoryLabel: (category: string) => string;
}

const BRAND = {
  navy: [15, 23, 42] as [number, number, number],
  indigo: [124, 58, 237] as [number, number, number],
  green: [5, 150, 105] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  pale: [248, 250, 252] as [number, number, number],
};

const money = (value: number) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: number, base: number) => base ? `${((value / base) * 100).toFixed(1)}%` : '0.0%';
const fileStamp = () => new Date().toISOString().slice(0, 10);
const generatedLabel = () => new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const downloadFinancePdf = async (data: FinanceReportPayload) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const portraitWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const generated = generatedLabel();

  const drawHeader = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND.navy);
    doc.rect(0, 0, pageWidth, 31, 'F');
    doc.setFillColor(...BRAND.indigo);
    doc.rect(0, 29, pageWidth, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('HOODBOY ENTERTAINMENT', margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${data.year} Annual Financial Report`, margin, 21);
    doc.text(`Generated ${generated}`, pageWidth - margin, 13, { align: 'right' });
    doc.text('Confidential - Internal Use', pageWidth - margin, 21, { align: 'right' });
  };

  const drawFooter = () => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const page = doc.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.slate);
    doc.text('HoodBoy Entertainment - Financial Operations', margin, pageHeight - 7);
    doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  const tableOptions = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, textColor: BRAND.navy, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.15 },
    headStyles: { fillColor: BRAND.navy, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: BRAND.pale },
    margin: { left: margin, right: margin, top: 36, bottom: 17 },
    didDrawPage: () => { drawHeader(); drawFooter(); },
  };

  drawHeader();
  const cards = [
    ['TOTAL REVENUE', money(data.summary.totalRevenue), BRAND.green],
    ['TOTAL EXPENSES', money(data.summary.totalExpenses), BRAND.red],
    ['NET PROFIT', money(data.summary.profit), data.summary.profit >= 0 ? BRAND.indigo : BRAND.red],
    ['NET MARGIN', percent(data.summary.profit, data.summary.totalRevenue), BRAND.slate],
  ] as const;
  const gap = 3;
  const cardWidth = (portraitWidth - margin * 2 - gap * 3) / 4;
  cards.forEach(([label, value, color], index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setFillColor(...BRAND.pale);
    doc.roundedRect(x, 38, cardWidth, 20, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.slate);
    doc.text(label, x + 3, 45);
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(value, x + 3, 53, { maxWidth: cardWidth - 6 });
  });

  autoTable(doc, {
    ...tableOptions,
    startY: 65,
    head: [['Month', 'Revenue', 'Expenses', 'Net Result', 'Margin']],
    body: data.summary.monthlyBreakdown.map(row => [
      row.name,
      money(row.revenue),
      money(row.expenses),
      money(row.profit),
      percent(row.profit, row.revenue),
    ]),
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  let nextY = (doc as any).lastAutoTable.finalY + 9;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.navy);
  doc.text('Category Performance', margin, nextY);
  autoTable(doc, {
    ...tableOptions,
    startY: nextY + 3,
    head: [['Category', 'Type', 'Amount', 'Share', 'Transactions']],
    body: data.categories.map(row => [data.categoryLabel(row.category), row.type, money(row.total), `${row.percentage}%`, row.count]),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  doc.addPage();
  drawHeader();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.navy);
  doc.text('Quarterly Performance', margin, 41);
  autoTable(doc, {
    ...tableOptions,
    startY: 45,
    head: [['Quarter', 'Revenue', 'Expenses', 'Net Result', 'Margin']],
    body: data.summary.quarterBreakdown.map(row => [`Q${row.quarter}`, money(row.revenue), money(row.expenses), money(row.profit), percent(row.profit, row.revenue)]),
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  });

  nextY = (doc as any).lastAutoTable.finalY + 10;
  doc.text('Top Revenue Artists', margin, nextY);
  autoTable(doc, {
    ...tableOptions,
    startY: nextY + 4,
    head: [['Rank', 'Artist', 'Revenue']],
    body: data.summary.topArtists.map((row, index) => [index + 1, row.name, money(row.total)]),
    columnStyles: { 0: { cellWidth: 18, halign: 'center' }, 2: { halign: 'right' } },
  });

  nextY = (doc as any).lastAutoTable.finalY + 10;
  doc.text('Budget Portfolio', margin, nextY);
  autoTable(doc, {
    ...tableOptions,
    startY: nextY + 4,
    head: [['Budget', 'Period', 'Department', 'Status', 'Budgeted', 'Tracked Spend']],
    body: data.budgets.map(row => [
      row.name,
      row.quarter ? `${row.year} Q${row.quarter}` : row.year,
      row.department || '-',
      row.status,
      money(row.totalBudget),
      money((row.items || []).reduce((sum, item) => sum + Number(item.spent || 0), 0)),
    ]),
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  doc.addPage('a4', 'landscape');
  drawHeader();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.navy);
  doc.text(`Transaction Ledger (${data.transactions.length} records)`, margin, 41);
  autoTable(doc, {
    ...tableOptions,
    startY: 45,
    head: [['Date', 'Type', 'Category', 'Description', 'Artist / Project', 'Status', 'Amount']],
    body: data.transactions.map(row => [
      new Date(row.date).toLocaleDateString('en-US'),
      row.type,
      data.categoryLabel(row.category),
      row.description || '-',
      row.artist?.stageName || row.artist?.artistName || row.artist?.name || row.project?.name || row.release?.title || row.department || '-',
      row.paymentStatus || '-',
      money(row.amount),
    ]),
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 2: { cellWidth: 38 }, 5: { cellWidth: 22 }, 6: { cellWidth: 29, halign: 'right' } },
  });

  doc.save(`HoodBoy_Financial_Report_${data.year}_${fileStamp()}.pdf`);
};

export const downloadFinanceExcel = async (data: FinanceReportPayload) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HoodBoy Entertainment';
  workbook.company = 'HoodBoy Entertainment';
  workbook.subject = `${data.year} Annual Financial Report`;
  workbook.created = new Date();
  workbook.modified = new Date();

  const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } as const;
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } } as const;
  const border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } } as const;
  const currencyFormat = '$#,##0.00;[Red]-$#,##0.00';

  const styleSheet = (sheet: any, title: string, columns: Array<{ header: string; key: string; width: number }>) => {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `HOODBOY ENTERTAINMENT | ${title}`;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 28;
    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.getCell(2, 1).value = `Generated ${generatedLabel()} | Confidential - Internal Use`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
    sheet.columns = columns;
    const headerRow = sheet.getRow(4);
    headerRow.values = columns.map(column => column.header);
    headerRow.height = 22;
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { vertical: 'middle' };
    });
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
  };

  const finishRows = (sheet: any, currencyColumns: number[] = []) => {
    sheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber <= 4) return;
      row.eachCell((cell: any) => { cell.border = border; cell.alignment = { vertical: 'top', wrapText: true }; });
      currencyColumns.forEach(column => { row.getCell(column).numFmt = currencyFormat; });
      if (rowNumber % 2 === 0) row.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    });
  };

  const executive = workbook.addWorksheet('Executive Summary', { properties: { tabColor: { argb: 'FF7C3AED' } } });
  styleSheet(executive, `${data.year} Executive Summary`, [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 22 },
    { header: 'Management Note', key: 'note', width: 48 },
  ]);
  [
    ['Total Revenue', data.summary.totalRevenue, 'Gross income recorded for the selected year'],
    ['Total Expenses', data.summary.totalExpenses, 'Operating and project expenses recorded'],
    ['Net Profit', data.summary.profit, data.summary.profit >= 0 ? 'Positive annual result' : 'Annual operating loss'],
    ['Net Margin', data.summary.totalRevenue ? data.summary.profit / data.summary.totalRevenue : 0, 'Net profit divided by total revenue'],
    ['Pending Payments', data.summary.pendingCount, 'Transactions currently awaiting settlement'],
    ['Transactions', data.transactions.length, 'Records included in this workbook'],
  ].forEach(row => executive.addRow(row));
  finishRows(executive);
  ['B5', 'B6', 'B7'].forEach(cell => { executive.getCell(cell).numFmt = currencyFormat; });
  executive.getCell('B8').numFmt = '0.0%';
  executive.getCell('B9').numFmt = '0';
  executive.getCell('B10').numFmt = '0';

  const monthly = workbook.addWorksheet('Monthly Performance');
  styleSheet(monthly, `${data.year} Monthly Performance`, [
    { header: 'Month', key: 'month', width: 16 }, { header: 'Revenue', key: 'revenue', width: 18 },
    { header: 'Expenses', key: 'expenses', width: 18 }, { header: 'Net Result', key: 'profit', width: 18 },
    { header: 'Running Balance', key: 'balance', width: 20 }, { header: 'Net Margin', key: 'margin', width: 16 },
  ]);
  data.summary.monthlyBreakdown.forEach((row, index) => monthly.addRow([row.name, row.revenue, row.expenses, row.profit, data.cashFlow[index]?.balance || 0, row.revenue ? row.profit / row.revenue : 0]));
  finishRows(monthly, [2, 3, 4, 5]);
  for (let row = 5; row <= monthly.rowCount; row++) monthly.getCell(row, 6).numFmt = '0.0%';

  const categories = workbook.addWorksheet('Category Analysis');
  styleSheet(categories, `${data.year} Category Analysis`, [
    { header: 'Category', key: 'category', width: 34 }, { header: 'Type', key: 'type', width: 14 },
    { header: 'Amount', key: 'amount', width: 18 }, { header: 'Portfolio Share', key: 'share', width: 18 },
    { header: 'Transactions', key: 'transactions', width: 16 },
  ]);
  data.categories.forEach(row => categories.addRow([data.categoryLabel(row.category), row.type, row.total, row.percentage / 100, row.count]));
  finishRows(categories, [3]);
  for (let row = 5; row <= categories.rowCount; row++) categories.getCell(row, 4).numFmt = '0.0%';

  const transactions = workbook.addWorksheet('Transactions');
  styleSheet(transactions, `${data.year} Transaction Ledger`, [
    { header: 'Date', key: 'date', width: 14 }, { header: 'Type', key: 'type', width: 12 },
    { header: 'Category', key: 'category', width: 28 }, { header: 'Description', key: 'description', width: 38 },
    { header: 'Artist / Project', key: 'attribution', width: 28 }, { header: 'Counterparty', key: 'counterparty', width: 24 },
    { header: 'Invoice', key: 'invoice', width: 18 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Amount', key: 'amount', width: 18 },
  ]);
  data.transactions.forEach(row => transactions.addRow([
    new Date(row.date), row.type, data.categoryLabel(row.category), row.description || '',
    row.artist?.stageName || row.artist?.artistName || row.artist?.name || row.project?.name || row.release?.title || row.department || '',
    row.counterparty || '', row.invoiceNumber || '', row.paymentStatus || '', row.amount,
  ]));
  finishRows(transactions, [9]);
  for (let row = 5; row <= transactions.rowCount; row++) transactions.getCell(row, 1).numFmt = 'mmm d, yyyy';

  const budgets = workbook.addWorksheet('Budgets');
  styleSheet(budgets, `${data.year} Budget Portfolio`, [
    { header: 'Budget', key: 'budget', width: 32 }, { header: 'Period', key: 'period', width: 14 },
    { header: 'Department', key: 'department', width: 24 }, { header: 'Status', key: 'status', width: 14 },
    { header: 'Total Budget', key: 'total', width: 20 }, { header: 'Tracked Spend', key: 'spent', width: 20 },
    { header: 'Remaining', key: 'remaining', width: 20 }, { header: 'Utilization', key: 'utilization', width: 16 },
  ]);
  data.budgets.forEach(row => {
    const spent = (row.items || []).reduce((sum, item) => sum + Number(item.spent || 0), 0);
    budgets.addRow([row.name, row.quarter ? `${row.year} Q${row.quarter}` : row.year, row.department || '', row.status, row.totalBudget, spent, row.totalBudget - spent, row.totalBudget ? spent / row.totalBudget : 0]);
  });
  finishRows(budgets, [5, 6, 7]);
  for (let row = 5; row <= budgets.rowCount; row++) budgets.getCell(row, 8).numFmt = '0.0%';

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `HoodBoy_Financial_Report_${data.year}_${fileStamp()}.xlsx`);
};
