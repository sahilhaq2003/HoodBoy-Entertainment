import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Calendar, CheckCircle2, Clock3, Disc3, Download,
  FileSpreadsheet, FolderKanban, Loader2, RefreshCw, Save, ShieldAlert,
  Sparkles, Trash2, UserCheck, Users,
} from 'lucide-react';
import { weeklyReportsApi } from '../services/api';
import type { WeeklyReport, WeeklyReportTaskInsight } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const emptyForm = {
  completed: '', stillOpen: '', blocked: '', needsApproval: '', dueThisWeek: '',
  biggestRisk: '', nextActionOwner: '', notes: '',
};
const readable = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const WeeklyReportPage: React.FC = () => {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [currentReport, setCurrentReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const hydrateForm = (report: WeeklyReport) => setForm({
    completed: report.completed || '', stillOpen: report.stillOpen || '', blocked: report.blocked || '',
    needsApproval: report.needsApproval || '', dueThisWeek: report.dueThisWeek || '',
    biggestRisk: report.biggestRisk || '', nextActionOwner: report.nextActionOwner || '', notes: report.notes || '',
  });

  const loadReports = useCallback(async (showSuccess = false) => {
    const currentRes = await weeklyReportsApi.getCurrentWeek();
    const current = currentRes.data.data as WeeklyReport;
    setCurrentReport(current);
    hydrateForm(current);
    const allRes = await weeklyReportsApi.getAll();
    setReports(allRes.data.data);
    if (showSuccess) toast.success('Weekly intelligence refreshed');
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await loadReports(); }
      catch (error) { console.error(error); toast.error('Failed to load weekly report'); }
      finally { setLoading(false); }
    })();
  }, [loadReports]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await loadReports(true); }
    catch (error) { console.error(error); toast.error('Could not refresh automated data'); }
    finally { setRefreshing(false); }
  };

  const handleSave = async () => {
    if (!currentReport) return;
    setSaving(true);
    try {
      const response = await weeklyReportsApi.update(currentReport._id, form);
      setCurrentReport(previous => previous ? { ...previous, ...response.data.data, automation: previous.automation } : previous);
      setReports((await weeklyReportsApi.getAll()).data.data);
      toast.success('Management commentary saved');
    } catch (error) { console.error(error); toast.error('Failed to save commentary'); }
    finally { setSaving(false); }
  };

  const handleDownload = async (format: 'pdf' | 'excel') => {
    if (!currentReport?.automation || exporting) return;
    setExporting(format);
    try {
      const { downloadWeeklyReportPdf, downloadWeeklyReportExcel } = await import('../utils/weeklyReportExport');
      const exportReport = { ...currentReport, ...form };
      if (format === 'pdf') await downloadWeeklyReportPdf(exportReport);
      else await downloadWeeklyReportExcel(exportReport);
      toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} weekly report downloaded`);
    } catch (error) { console.error(error); toast.error(`Could not generate ${format.toUpperCase()} report`); }
    finally { setExporting(null); }
  };

  const handleDelete = async (id: string) => {
    try { await weeklyReportsApi.delete(id); setReports(previous => previous.filter(report => report._id !== id)); toast.success('Report deleted'); }
    catch (error) { console.error(error); toast.error('Failed to delete report'); }
  };

  const formatDateRange = (start: string, end: string) => {
    const from = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const to = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${from} – ${to}`;
  };
  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline';
  const automation = currentReport?.automation;
  const priorityClass = (priority: string) => ({ critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' }[priority] || 'bg-slate-100 text-slate-600');

  const TaskTable = ({ tasks, emptyText }: { tasks: WeeklyReportTaskInsight[]; emptyText: string }) => tasks.length ? (
    <div className="overflow-x-auto"><table className="w-full min-w-[620px]">
      <thead><tr className="border-b border-slate-100 bg-slate-50/70">{['Task', 'Owner', 'Priority', 'Deadline', 'Project'].map(label => <th key={label} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</th>)}</tr></thead>
      <tbody>{tasks.map(task => <tr key={task._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
        <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-900">{task.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{readable(task.category)}</p></td>
        <td className="px-4 py-3 text-xs font-medium text-slate-600">{task.assignee}</td>
        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${priorityClass(task.priority)}`}>{task.priority}</span></td>
        <td className="px-4 py-3 text-xs text-slate-600">{formatDate(task.deadline)}</td><td className="px-4 py-3 text-xs text-slate-500">{task.project || '—'}</td>
      </tr>)}</tbody>
    </table></div>
  ) : <div className="px-6 py-10 text-center"><CheckCircle2 size={26} className="mx-auto mb-2 text-emerald-400" /><p className="text-sm text-slate-500">{emptyText}</p></div>;

  if (loading) return <div className="flex justify-center py-24"><RefreshCw size={26} className="animate-spin text-violet-500" /></div>;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-600"><Activity size={23} /></span><div><h1 className="text-2xl font-bold text-slate-950">Weekly Operations Report</h1><p className="mt-0.5 text-sm text-slate-500">Automated performance, delivery risk, and ownership intelligence</p></div></div>
      {currentReport && <div className="flex flex-wrap gap-2">
        <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
        <button onClick={() => handleDownload('pdf')} disabled={!automation || exporting !== null} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">{exporting === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF</button>
        <button onClick={() => handleDownload('excel')} disabled={!automation || exporting !== null} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">{exporting === 'excel' ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Excel</button>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Notes</button>
      </div>}
    </div>

    <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1"><button onClick={() => setActiveTab('current')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'current' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Live Report</button><button onClick={() => setActiveTab('history')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'history' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>History ({reports.length})</button></div>

    {activeTab === 'current' && currentReport && automation && <>
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" /><div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-300"><Sparkles size={14} /> Automatically generated</div><h2 className="text-2xl font-bold">Week of {formatDateRange(currentReport.weekStart, currentReport.weekEnd)}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Live Tasks, Projects, and Releases data. Add management commentary only for decisions and context the system cannot infer.</p></div><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300"><p className="font-semibold text-white">Last generated</p><p className="mt-1">{new Date(automation.generatedAt).toLocaleString()}</p></div></div></section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{[
        { label: 'Completed', value: automation.metrics.completed, icon: CheckCircle2, tone: 'text-emerald-600', bg: 'bg-emerald-50' }, { label: 'Active', value: automation.metrics.active, icon: Activity, tone: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Due this week', value: automation.metrics.dueThisWeek, icon: Clock3, tone: 'text-cyan-600', bg: 'bg-cyan-50' }, { label: 'Overdue', value: automation.metrics.overdue, icon: AlertTriangle, tone: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Blocked', value: automation.metrics.blocked, icon: ShieldAlert, tone: 'text-orange-600', bg: 'bg-orange-50' }, { label: 'Completion', value: `${automation.metrics.completionRate}%`, icon: Activity, tone: 'text-violet-600', bg: 'bg-violet-50' },
      ].map(metric => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${metric.bg} ${metric.tone}`}><metric.icon size={17} /></div><p className="text-2xl font-bold text-slate-950">{metric.value}</p><p className="mt-1 text-xs font-medium text-slate-500">{metric.label}</p></div>)}</section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)]"><div className="space-y-6">
        <ReportSection title="Overdue Work" subtitle="Past-deadline tasks requiring immediate review" count={automation.overdueTasks.length} tone="red" icon={<AlertTriangle size={17} />}><TaskTable tasks={automation.overdueTasks} emptyText="No overdue work detected" /></ReportSection>
        <div className="grid gap-6 lg:grid-cols-2"><ReportSection title="Blocked" count={automation.blockedTasks.length} tone="orange" icon={<ShieldAlert size={17} />}><TaskTable tasks={automation.blockedTasks} emptyText="No blocked tasks" /></ReportSection><ReportSection title="Awaiting Approval" count={automation.approvalTasks.length} tone="violet" icon={<UserCheck size={17} />}><TaskTable tasks={automation.approvalTasks} emptyText="No approvals waiting" /></ReportSection></div>
        <ReportSection title="Completed This Week" subtitle="Verified delivery recorded during this period" count={automation.completedTasks.length} tone="emerald" icon={<CheckCircle2 size={17} />}><TaskTable tasks={automation.completedTasks} emptyText="No completed tasks recorded this week" /></ReportSection>
        <ReportSection title="Due This Week" subtitle="Current reporting-period commitments" count={automation.dueTasks.length} tone="cyan" icon={<Calendar size={17} />}><TaskTable tasks={automation.dueTasks} emptyText="No active tasks due this week" /></ReportSection>
      </div><aside className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><PanelTitle icon={<Users size={17} className="text-blue-500" />} title="Ownership Load" subtitle="Active work and exception concentration" /><div className="mt-4 space-y-3">{automation.ownerWorkload.slice(0, 8).map(owner => { const risk = owner.overdue + owner.blocked + owner.critical; return <div key={owner.owner} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-800">{owner.owner}</span><span className="text-xs font-bold text-slate-600">{owner.total} active</span></div><div className="mt-2 flex gap-2 text-[10px]"><span className={owner.overdue ? 'rounded bg-red-100 px-1.5 py-0.5 text-red-700' : 'rounded bg-slate-200 px-1.5 py-0.5 text-slate-500'}>{owner.overdue} overdue</span><span className={owner.blocked ? 'rounded bg-orange-100 px-1.5 py-0.5 text-orange-700' : 'rounded bg-slate-200 px-1.5 py-0.5 text-slate-500'}>{owner.blocked} blocked</span>{risk > 0 && <span className="ml-auto font-bold text-red-600">Risk {risk}</span>}</div></div>; })}{automation.ownerWorkload.length === 0 && <Empty text="No active workload" />}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><PanelTitle icon={<FolderKanban size={17} className="text-orange-500" />} title="At-Risk Projects" subtitle="Critical, delayed, or past-date" count={automation.atRiskProjects.length} /><div className="mt-4 space-y-3">{automation.atRiskProjects.slice(0, 6).map(project => <div key={project._id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{project.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{project.artist || 'No artist'} · {project.owner}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${priorityClass(project.priority)}`}>{project.priority}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${project.completionPercentage}%` }} /></div></div>)}{automation.atRiskProjects.length === 0 && <Empty text="No at-risk projects" />}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><PanelTitle icon={<Disc3 size={17} className="text-violet-500" />} title="Release Pipeline" subtitle="Next 30 days" count={automation.upcomingReleases.length} /><div className="mt-4 space-y-3">{automation.upcomingReleases.slice(0, 6).map(release => <div key={release._id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-semibold text-slate-900">{release.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{release.artist || 'No artist'} · {release.owner}</p></div><div className="text-right"><p className="text-xs font-bold text-violet-600">{formatDate(release.releaseDate)}</p><p className="mt-0.5 text-[10px] text-slate-400">{readable(release.status)}</p></div></div>)}{automation.upcomingReleases.length === 0 && <Empty text="No releases in the next 30 days" />}</div></section>
        <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm"><PanelTitle title="Leadership Commentary" subtitle="Decisions and context that system data cannot determine" /><div className="mt-4 space-y-4">{[
          ['biggestRisk', 'Biggest management risk', 'Summarize the most important risk...'], ['nextActionOwner', 'Next action and owner', 'Name the owner and required next action...'], ['needsApproval', 'Decision or approval needed', 'Record leadership decisions required...'], ['notes', 'Executive notes', 'Add concise context for the weekly record...'],
        ].map(([key, label, placeholder]) => <label key={key} className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span><textarea value={form[key as keyof typeof form]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} placeholder={placeholder} rows={key === 'notes' ? 3 : 2} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></label>)}</div></section>
      </aside></div>
    </>}

    {activeTab === 'current' && currentReport && !automation && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><AlertTriangle size={30} className="mx-auto mb-3 text-amber-500" /><h3 className="font-bold text-amber-900">Automated intelligence is unavailable</h3><p className="mt-1 text-sm text-amber-700">Refresh after the backend deployment completes.</p></div>}
    {activeTab === 'history' && <div className="grid gap-4 lg:grid-cols-2">{reports.map(report => <article key={report._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">Weekly record</p><h3 className="mt-1 text-base font-bold text-slate-900">{formatDateRange(report.weekStart, report.weekEnd)}</h3><p className="mt-1 text-xs text-slate-500">Prepared by {report.createdBy?.name || 'System'}</p></div><button onClick={() => setDeleteTarget(report._id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold text-slate-500">Risk noted</p><p className="mt-1 truncate text-slate-800">{report.biggestRisk || 'No note'}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold text-slate-500">Next owner</p><p className="mt-1 truncate text-slate-800">{report.nextActionOwner || 'Not assigned'}</p></div></div></article>)}{reports.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-500"><Calendar size={38} className="mx-auto mb-3 text-slate-300" /><p className="text-sm">No weekly report history yet</p></div>}</div>}
    <ConfirmDialog isOpen={!!deleteTarget} title="Delete Report" message="Are you sure you want to delete this weekly report? This action cannot be undone." confirmLabel="Delete" onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />
  </div>;
};

const toneClasses = { red: 'border-red-100 bg-red-50/60 text-red-500', orange: 'border-orange-100 bg-orange-50/60 text-orange-500', violet: 'border-violet-100 bg-violet-50/60 text-violet-500', emerald: 'border-emerald-100 bg-emerald-50/60 text-emerald-500', cyan: 'border-cyan-100 bg-cyan-50/60 text-cyan-600' };
const ReportSection = ({ title, subtitle, count, tone, icon, children }: { title: string; subtitle?: string; count: number; tone: keyof typeof toneClasses; icon: React.ReactNode; children: React.ReactNode }) => <section className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${toneClasses[tone].split(' ')[0]}`}><div className={`flex items-center justify-between border-b px-5 py-4 ${toneClasses[tone]}`}><div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className={toneClasses[tone].split(' ').at(-1)}>{icon}</span>{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-700">{count}</span></div>{children}</section>;
const PanelTitle = ({ icon, title, subtitle, count }: { icon?: React.ReactNode; title: string; subtitle: string; count?: number }) => <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">{icon}{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{count !== undefined && <span className="text-xs font-bold text-violet-600">{count}</span>}</div>;
const Empty = ({ text }: { text: string }) => <p className="py-6 text-center text-sm text-slate-400">{text}</p>;

export default WeeklyReportPage;
