import type { WeeklyReport, WeeklyReportTaskInsight } from '../types';

const NAVY = [15, 23, 42] as [number, number, number];
const VIOLET = [124, 58, 237] as [number, number, number];
const SLATE = [71, 85, 105] as [number, number, number];
const PALE = [248, 250, 252] as [number, number, number];

const dateRange = (start: string, end: string) => {
  const from = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const to = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${from} - ${to}`;
};

const generatedLabel = () => new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const stamp = () => new Date().toISOString().slice(0, 10);
const readable = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

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

export const downloadWeeklyReportPdf = async (report: WeeklyReport) => {
  if (!report.automation) throw new Error('Automated report data is unavailable');
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const automation = report.automation;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;

  const header = () => {
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, width, 31, 'F');
    doc.setFillColor(...VIOLET);
    doc.rect(0, 29, width, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('HOODBOY ENTERTAINMENT', margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Weekly Operations Report | ${dateRange(report.weekStart, report.weekEnd)}`, margin, 21);
    doc.text('Confidential - Internal Use', width - margin, 13, { align: 'right' });
    doc.text(`Generated ${generatedLabel()}`, width - margin, 21, { align: 'right' });
  };

  const footer = () => {
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, height - 12, width - margin, height - 12);
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('HoodBoy Entertainment - Weekly Operations', margin, height - 7);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, width - margin, height - 7, { align: 'right' });
  };

  const tableBase = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 2.2, textColor: NAVY, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.15 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: PALE },
    margin: { left: margin, right: margin, top: 36, bottom: 17 },
    didDrawPage: () => { header(); footer(); },
  };

  header();
  const metricCards = [
    ['COMPLETED', automation.metrics.completed, [5, 150, 105]],
    ['ACTIVE', automation.metrics.active, [37, 99, 235]],
    ['OVERDUE', automation.metrics.overdue, [220, 38, 38]],
    ['BLOCKED', automation.metrics.blocked, [234, 88, 12]],
    ['APPROVALS', automation.metrics.approvals, VIOLET],
    ['COMPLETION', `${automation.metrics.completionRate}%`, SLATE],
  ] as const;
  const width = doc.internal.pageSize.getWidth();
  const gap = 2.5;
  const cardWidth = (width - margin * 2 - gap * 5) / 6;
  metricCards.forEach(([label, value, color], index) => {
    const x = margin + index * (cardWidth + gap);
    doc.setFillColor(...PALE);
    doc.roundedRect(x, 38, cardWidth, 19, 2, 2, 'F');
    doc.setTextColor(...SLATE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(label, x + 2.5, 45);
    doc.setTextColor(...(color as [number, number, number]));
    doc.setFontSize(12);
    doc.text(String(value), x + 2.5, 53);
  });

  const taskRows = (tasks: WeeklyReportTaskInsight[]) => tasks.map(task => [
    task.title,
    task.assignee,
    readable(task.priority),
    task.deadline ? new Date(task.deadline).toLocaleDateString('en-US') : '-',
    task.project || '-',
  ]);

  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('Executive Work Summary', margin, 67);
  autoTable(doc, {
    ...tableBase,
    startY: 71,
    head: [['Status', 'Count', 'Management Interpretation']],
    body: [
      ['Completed this week', automation.metrics.completed, 'Delivered outcomes recorded during this reporting period'],
      ['Due this week', automation.metrics.dueThisWeek, 'Active tasks with deadlines inside the reporting period'],
      ['Overdue', automation.metrics.overdue, automation.metrics.overdue ? 'Immediate schedule intervention recommended' : 'No overdue work detected'],
      ['Blocked', automation.metrics.blocked, automation.metrics.blocked ? 'Dependencies or decisions require escalation' : 'No blocked work detected'],
      ['At-risk projects', automation.metrics.atRiskProjects, 'Delayed, critical, or past-date active projects'],
      ['Upcoming releases', automation.metrics.upcomingReleases, 'Scheduled within the next 30 days'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 1: { halign: 'center', cellWidth: 18 } },
  });

  let y = (doc as any).lastAutoTable.finalY + 9;
  const addTaskSection = (title: string, tasks: WeeklyReportTaskInsight[]) => {
    if (y > 245) { doc.addPage(); header(); y = 41; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`${title} (${tasks.length})`, margin, y);
    autoTable(doc, {
      ...tableBase,
      startY: y + 3,
      head: [['Task', 'Owner', 'Priority', 'Deadline', 'Project']],
      body: taskRows(tasks.length ? tasks : [{ _id: '', title: 'No items recorded', status: '', priority: '-', category: '', assignee: '-' }]),
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 32 }, 2: { cellWidth: 22 }, 3: { cellWidth: 26 } },
    });
    y = (doc as any).lastAutoTable.finalY + 9;
  };

  addTaskSection('Completed Work', automation.completedTasks);
  addTaskSection('Overdue Work', automation.overdueTasks);
  addTaskSection('Blocked Work', automation.blockedTasks);
  addTaskSection('Awaiting Approval', automation.approvalTasks);

  doc.addPage();
  header();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text('Team Workload & Risk', margin, 41);
  autoTable(doc, {
    ...tableBase,
    startY: 45,
    head: [['Owner', 'Active', 'Overdue', 'Blocked', 'Critical']],
    body: automation.ownerWorkload.map(owner => [owner.owner, owner.total, owner.overdue, owner.blocked, owner.critical]),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' } },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  doc.text(`At-Risk Projects (${automation.atRiskProjects.length})`, margin, y);
  autoTable(doc, {
    ...tableBase,
    startY: y + 4,
    head: [['Project', 'Artist', 'Owner', 'Status', 'Priority', 'Progress']],
    body: automation.atRiskProjects.map(project => [project.name, project.artist || '-', project.owner, readable(project.status), readable(project.priority), `${project.completionPercentage}%`]),
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 245) { doc.addPage(); header(); y = 41; }
  doc.text(`Upcoming Releases (${automation.upcomingReleases.length})`, margin, y);
  autoTable(doc, {
    ...tableBase,
    startY: y + 4,
    head: [['Release', 'Artist', 'Owner', 'Date', 'Status', 'Priority']],
    body: automation.upcomingReleases.map(release => [release.title, release.artist || '-', release.owner, new Date(release.releaseDate).toLocaleDateString('en-US'), readable(release.status), readable(release.priority)]),
  });

  doc.addPage();
  header();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('Leadership Commentary', margin, 43);
  const notes = [
    ['Biggest Risk', report.biggestRisk || 'No management risk note entered.'],
    ['Next Action Owner', report.nextActionOwner || 'No next-action owner entered.'],
    ['Approvals / Decisions', report.needsApproval || 'See automated approval queue.'],
    ['Additional Notes', report.notes || 'No additional notes entered.'],
  ];
  autoTable(doc, { ...tableBase, startY: 48, head: [['Section', 'Commentary']], body: notes, columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } } });

  doc.save(`HoodBoy_Weekly_Report_${stamp()}.pdf`);
};

export const downloadWeeklyReportExcel = async (report: WeeklyReport) => {
  if (!report.automation) throw new Error('Automated report data is unavailable');
  const { default: ExcelJS } = await import('exceljs');
  const automation = report.automation;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HoodBoy Entertainment';
  workbook.company = 'HoodBoy Entertainment';
  workbook.subject = `Weekly Operations Report ${dateRange(report.weekStart, report.weekEnd)}`;
  workbook.created = new Date();

  const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } as const;
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } } as const;
  const border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } } as const;

  const prepare = (sheet: any, title: string, columns: Array<{ header: string; key: string; width: number }>) => {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `HOODBOY ENTERTAINMENT | ${title}`;
    titleCell.fill = titleFill;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
    titleCell.alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 28;
    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.getCell(2, 1).value = `${dateRange(report.weekStart, report.weekEnd)} | Generated ${generatedLabel()} | Confidential`;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: 'FF64748B' }, size: 9 };
    sheet.columns = columns;
    const headers = sheet.getRow(4);
    headers.values = columns.map(column => column.header);
    headers.eachCell((cell: any) => { cell.fill = headerFill; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    headers.height = 22;
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
  };

  const finish = (sheet: any) => sheet.eachRow((row: any, rowNumber: number) => {
    if (rowNumber <= 4) return;
    row.eachCell((cell: any) => { cell.border = border; cell.alignment = { vertical: 'top', wrapText: true }; });
    if (rowNumber % 2 === 0) row.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
  });

  const summary = workbook.addWorksheet('Executive Summary', { properties: { tabColor: { argb: 'FF7C3AED' } } });
  prepare(summary, 'Weekly Executive Summary', [{ header: 'Metric', key: 'metric', width: 28 }, { header: 'Value', key: 'value', width: 16 }, { header: 'Interpretation', key: 'interpretation', width: 55 }]);
  [
    ['Completed', automation.metrics.completed, 'Tasks completed during the reporting week'],
    ['Active', automation.metrics.active, 'All active tasks at generation time'],
    ['Completion Rate', automation.metrics.completionRate / 100, 'Completed work as a share of current workload'],
    ['Due This Week', automation.metrics.dueThisWeek, 'Active tasks due inside this reporting period'],
    ['Overdue', automation.metrics.overdue, 'Past-deadline active tasks'],
    ['Blocked', automation.metrics.blocked, 'Tasks requiring dependency resolution'],
    ['Awaiting Approval', automation.metrics.approvals, 'Tasks waiting for management approval'],
    ['At-Risk Projects', automation.metrics.atRiskProjects, 'Delayed, critical, or past-date projects'],
    ['Upcoming Releases', automation.metrics.upcomingReleases, 'Releases scheduled within 30 days'],
  ].forEach(row => summary.addRow(row));
  finish(summary);
  summary.getCell('B7').numFmt = '0%';

  const tasks = workbook.addWorksheet('Task Detail');
  prepare(tasks, 'Automated Task Detail', [
    { header: 'Group', key: 'group', width: 20 }, { header: 'Task', key: 'task', width: 40 }, { header: 'Owner', key: 'owner', width: 24 },
    { header: 'Status', key: 'status', width: 18 }, { header: 'Priority', key: 'priority', width: 14 }, { header: 'Category', key: 'category', width: 18 },
    { header: 'Deadline', key: 'deadline', width: 16 }, { header: 'Project', key: 'project', width: 28 },
  ]);
  const taskGroups: Array<[string, WeeklyReportTaskInsight[]]> = [
    ['Completed', automation.completedTasks], ['Open', automation.openTasks], ['Blocked', automation.blockedTasks],
    ['Awaiting Approval', automation.approvalTasks], ['Due This Week', automation.dueTasks], ['Overdue', automation.overdueTasks],
  ];
  taskGroups.forEach(([group, rows]) => rows.forEach(task => tasks.addRow([group, task.title, task.assignee, readable(task.status), readable(task.priority), readable(task.category), task.deadline ? new Date(task.deadline) : '', task.project || ''])));
  finish(tasks);
  for (let row = 5; row <= tasks.rowCount; row++) tasks.getCell(row, 7).numFmt = 'mmm d, yyyy';

  const workload = workbook.addWorksheet('Owner Workload');
  prepare(workload, 'Team Workload & Risk', [
    { header: 'Owner', key: 'owner', width: 30 }, { header: 'Active Tasks', key: 'active', width: 16 }, { header: 'Overdue', key: 'overdue', width: 14 },
    { header: 'Blocked', key: 'blocked', width: 14 }, { header: 'Critical', key: 'critical', width: 14 }, { header: 'Risk Score', key: 'risk', width: 14 },
  ]);
  automation.ownerWorkload.forEach(owner => workload.addRow([owner.owner, owner.total, owner.overdue, owner.blocked, owner.critical, owner.overdue + owner.blocked + owner.critical]));
  finish(workload);

  const pipeline = workbook.addWorksheet('Projects & Releases');
  prepare(pipeline, 'Delivery Pipeline', [
    { header: 'Record Type', key: 'type', width: 18 }, { header: 'Name', key: 'name', width: 38 }, { header: 'Artist', key: 'artist', width: 26 },
    { header: 'Owner', key: 'owner', width: 24 }, { header: 'Status', key: 'status', width: 20 }, { header: 'Priority', key: 'priority', width: 14 },
    { header: 'Date / Progress', key: 'detail', width: 20 },
  ]);
  automation.atRiskProjects.forEach(project => pipeline.addRow(['At-Risk Project', project.name, project.artist || '', project.owner, readable(project.status), readable(project.priority), `${project.completionPercentage}%`]));
  automation.upcomingReleases.forEach(release => pipeline.addRow(['Upcoming Release', release.title, release.artist || '', release.owner, readable(release.status), readable(release.priority), new Date(release.releaseDate)]));
  finish(pipeline);

  const notes = workbook.addWorksheet('Management Notes');
  prepare(notes, 'Leadership Commentary', [{ header: 'Section', key: 'section', width: 30 }, { header: 'Commentary', key: 'commentary', width: 90 }]);
  [
    ['Biggest Risk', report.biggestRisk || ''], ['Next Action Owner', report.nextActionOwner || ''],
    ['Approvals / Decisions', report.needsApproval || ''], ['Additional Notes', report.notes || ''],
  ].forEach(row => notes.addRow(row));
  finish(notes);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `HoodBoy_Weekly_Report_${stamp()}.xlsx`);
};
