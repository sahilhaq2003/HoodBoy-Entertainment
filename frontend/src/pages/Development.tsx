import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import {
  TrendingUp, Users, ClipboardCheck, Award, Search, Plus,
  ArrowUpRight, ArrowDownRight, Target, Star, X, Edit2, Trash2, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developmentApi, artistsApi } from '../services/api';
import type { DevelopmentDashboardData, DevelopmentPlan, Artist, SkillRatings } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getInitials, getAvatarColor } from '../utils/helpers';

const SKILL_LABELS: Record<keyof SkillRatings, string> = {
  musicQuality: 'Music Quality',
  songwriting: 'Songwriting',
  vocalAbility: 'Vocal Ability',
  stagePerformance: 'Stage Performance',
  branding: 'Branding',
  visualIdentity: 'Visual Identity',
  socialMediaConsistency: 'Social Media',
  interviewSkills: 'Interview Skills',
  fanEngagement: 'Fan Engagement',
  professionalBehavior: 'Professionalism',
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface EditablePlanGoal {
  category: keyof SkillRatings;
  title: string;
  description: string;
  targetDate: string;
  completed: boolean;
  progress: number;
}

const emptyPlanGoal = (): EditablePlanGoal => ({
  category: 'musicQuality', title: '', description: '', targetDate: '', completed: false, progress: 0,
});

const GoalEditor: React.FC<{
  goals: EditablePlanGoal[];
  onChange: (goals: EditablePlanGoal[]) => void;
}> = ({ goals, onChange }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-medium text-gray-700">Development Goals <span className="text-red-500">*</span></label>
      <button type="button" onClick={() => onChange([...goals, emptyPlanGoal()])} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
        <Plus size={13} /> Add Goal
      </button>
    </div>
    <div className="space-y-3">
      {goals.map((goal, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] gap-2">
            <select value={goal.category} onChange={event => onChange(goals.map((item, i) => i === index ? { ...item, category: event.target.value as keyof SkillRatings } : item))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-indigo-500">
              {(Object.entries(SKILL_LABELS) as Array<[keyof SkillRatings, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={goal.title} onChange={event => onChange(goals.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="Specific development goal" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-indigo-500" />
            <button type="button" onClick={() => onChange(goals.filter((_, i) => i !== index))} disabled={goals.length === 1} className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30" title="Remove goal"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px_90px] gap-2">
            <input value={goal.description} onChange={event => onChange(goals.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} placeholder="Actions, coaching, or expected result" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-indigo-500" />
            <input type="date" value={goal.targetDate} onChange={event => onChange(goals.map((item, i) => i === index ? { ...item, targetDate: event.target.value } : item))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-indigo-500" />
            <div className="relative">
              <input type="number" min="0" max="100" value={goal.progress} onChange={event => onChange(goals.map((item, i) => i === index ? { ...item, progress: Math.min(100, Math.max(0, Number(event.target.value))) } : item))} className="w-full px-3 py-2 pr-7 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-indigo-500" />
              <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Development: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DevelopmentDashboardData | null>(null);
  const [plans, setPlans] = useState<DevelopmentPlan[]>([]);
  const [search, setSearch] = useState('');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [newPlan, setNewPlan] = useState({ artistId: '', title: '', description: '', focusAreas: '' });
  const [newGoals, setNewGoals] = useState<EditablePlanGoal[]>([emptyPlanGoal()]);
  const [creating, setCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DevelopmentPlan | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', focusAreas: '', status: 'active' as DevelopmentPlan['status'] });
  const [editGoals, setEditGoals] = useState<EditablePlanGoal[]>([emptyPlanGoal()]);
  const [updating, setUpdating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, plansRes] = await Promise.all([
        developmentApi.getDashboard(),
        developmentApi.getAll(),
      ]);
      setStats(dashRes.data.data);
      setPlans(plansRes.data.data);
    } catch (e) { console.error(e); toast.error('Failed to load development data'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNewPlan = async () => {
    setShowNewPlan(true);
    try {
      const res = await artistsApi.getAll({ limit: 100 });
      setArtists(res.data.data);
    } catch (e) { console.error(e); }
  };

  const createPlan = async () => {
    if (!newPlan.artistId || !newPlan.title) return;
    const goals = newGoals.filter(goal => goal.title.trim());
    if (goals.length === 0) { toast.error('Add at least one development goal'); return; }
    setCreating(true);
    try {
      await developmentApi.create({
        artistId: newPlan.artistId,
        title: newPlan.title,
        description: newPlan.description,
        focusAreas: newPlan.focusAreas.split(',').map(s => s.trim()).filter(Boolean),
        goals,
      });
      setShowNewPlan(false);
      setNewPlan({ artistId: '', title: '', description: '', focusAreas: '' });
      setNewGoals([emptyPlanGoal()]);
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to create plan'); }
    setCreating(false);
  };

  const openEdit = (plan: DevelopmentPlan) => {
    setEditingPlan(plan);
    setEditForm({
      title: plan.title,
      description: plan.description || '',
      focusAreas: plan.focusAreas?.join(', ') || '',
      status: plan.status,
    });
    setEditGoals(plan.goals?.length ? plan.goals.map(goal => ({
      category: (goal.category || 'musicQuality') as keyof SkillRatings,
      title: goal.title,
      description: goal.description || '',
      targetDate: goal.targetDate ? goal.targetDate.split('T')[0] : '',
      completed: goal.completed,
      progress: goal.progress || 0,
    })) : [emptyPlanGoal()]);
  };

  const handleUpdate = async () => {
    if (!editingPlan) return;
    const goals = editGoals.filter(goal => goal.title.trim());
    if (goals.length === 0) { toast.error('Add at least one development goal'); return; }
    setUpdating(true);
    try {
      await developmentApi.update(editingPlan._id, {
        title: editForm.title,
        description: editForm.description,
        focusAreas: editForm.focusAreas.split(',').map(s => s.trim()).filter(Boolean),
        status: editForm.status,
        goals,
      });
      toast.success('Plan updated');
      setEditingPlan(null);
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to update plan'); }
    setUpdating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await developmentApi.delete(deleteId);
      toast.success('Plan deleted');
      setDeleteId(null);
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed to delete plan'); }
    setDeleting(false);
  };

  const filtered = plans.filter(p => {
    const name = (p.artistId as any)?.artistName || (p.artistId as any)?.name || '';
    return !search || name.toLowerCase().includes(search.toLowerCase()) || p.title.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading development data..." /></div>;
  }

  const radarData = stats ? Object.entries(stats.skillAverages).map(([key, val]) => ({
    subject: SKILL_LABELS[key as keyof SkillRatings] || key,
    score: val,
    fullMark: 10,
  })) : [];

  const topArtists = (stats?.latestPerArtist || [])
    .sort((a, b) => (b.scorecard?.overallScore || 0) - (a.scorecard?.overallScore || 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Plans', value: stats?.activePlans || 0, icon: <Target size={16} />, color: '#4F46E5', sub: 'In progress' },
          { label: 'Artists Tracked', value: stats?.totalArtistsTracked || 0, icon: <Users size={16} />, color: '#06B6D4', sub: 'Total enrolled' },
          { label: 'Scorecards', value: stats?.totalScorecards || 0, icon: <ClipboardCheck size={16} />, color: '#10B981', sub: 'All time' },
          { label: 'Avg Score', value: stats?.latestPerArtist.length ? (stats.latestPerArtist.reduce((s, a) => s + (a.scorecard?.overallScore || 0), 0) / stats.latestPerArtist.length).toFixed(1) : '—', icon: <Award size={16} />, color: '#F5A623', sub: 'Latest month', suffix: '/10' },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}{(s as any).suffix || ''}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Skill Overview</h3>
          <p className="text-xs text-gray-500 mb-4">Average ratings across all artists</p>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Chart */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Score Trend</h3>
          <p className="text-xs text-gray-500 mb-5">Monthly average overall scores</p>
          {(stats?.monthlyTrend?.length || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats?.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12 }}
                  formatter={(value) => [Number(value).toFixed(1), 'Avg Score']}
                />
                <Line type="monotone" dataKey="avgScore" name="Avg Score" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">No scorecard data yet</div>
          )}
        </div>
      </div>

      {/* Artist Rankings + Skill Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Artists */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Artist Rankings</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest scores by artist</p>
          </div>
          <div className="divide-y divide-gray-50">
            {topArtists.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No artists scored yet</div>
            )}
            {topArtists.map((item, idx) => {
              const name = (item.artist as any).artistName || (item.artist as any).name || 'Unknown';
              const score = item.scorecard?.overallScore || 0;
              const prev = stats?.latestPerArtist.find(a => (a.artist as any)._id === (item.artist as any)._id);
              return (
                <div
                  key={idx}
                  className="px-6 py-3.5 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/development/artist/${(item.artist as any)._id}`)}
                >
                  <div className="text-sm font-bold text-gray-400 w-6 text-center">#{idx + 1}</div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: getAvatarColor(name) }}
                  >
                    {(item.artist as any).image ? (
                      <img src={(item.artist as any).image} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-xl" />
                    ) : getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                    <div className="text-xs text-gray-500">{(item.artist as any).genre || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${score >= 7 ? 'text-emerald-600' : score >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                      {score.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-400">/10</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill Breakdown Bars */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-1">Skill Breakdown</h3>
          <p className="text-xs text-gray-500 mb-5">Average score per skill area</p>
          <div className="space-y-3">
            {Object.entries(stats?.skillAverages || {}).map(([key, val]) => {
              const pct = (val / 10) * 100;
              const color = val >= 7 ? '#10B981' : val >= 5 ? '#F5A623' : '#EF4444';
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{SKILL_LABELS[key as keyof SkillRatings]}</span>
                    <span className="text-xs font-bold text-gray-900">{val}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Development Plans</h3>
            <p className="text-xs text-gray-500 mt-0.5">{plans.length} total plan(s)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search plans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1"
              />
            </div>
            <button
              onClick={openNewPlan}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <Plus size={14} /> New Plan
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Artist', 'Plan', 'Status', 'Goals', 'Scorecards', 'Latest Score', 'Updated', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(plan => {
                const artist = plan.artistId as any;
                const name = artist?.artistName || artist?.name || 'Unknown';
                const latest = plan.scorecards?.length ? plan.scorecards[plan.scorecards.length - 1] : null;
                const goalsCompleted = plan.goals?.filter(g => g.completed).length || 0;
                const goalsTotal = plan.goals?.length || 0;
                return (
                  <tr
                    key={plan._id}
                    className="hover:bg-gray-50 transition-colors border-b border-gray-50 cursor-pointer"
                    onClick={() => navigate(`/development/artist/${artist?._id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: getAvatarColor(name) }}>
                          {artist?.image ? <img src={artist.image} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-lg" /> : getInitials(name)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{name}</div>
                          <div className="text-xs text-gray-500">{artist?.genre || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm text-gray-900 font-medium">{plan.title}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{plan.description || 'No description'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                        plan.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        plan.status === 'completed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        plan.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{goalsCompleted}/{goalsTotal}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{plan.scorecards?.length || 0}</td>
                    <td className="px-5 py-3.5">
                      {latest ? (
                        <span className={`text-sm font-bold ${latest.overallScore >= 7 ? 'text-emerald-600' : latest.overallScore >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                          {latest.overallScore.toFixed(1)}/10
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {new Date(plan.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setDeleteId(plan._id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-gray-400 text-sm">
                    {search ? 'No plans match your search' : 'No development plans yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Plan Modal */}
      {showNewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowNewPlan(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-xl p-6 dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Development Plan</h3>
              <button onClick={() => setShowNewPlan(false)} className="text-gray-400 hover:text-gray-600 p-1 dark:text-gray-500 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Artist <span className="text-red-500">*</span></label>
                <select
                  value={newPlan.artistId}
                  onChange={(e) => setNewPlan({ ...newPlan, artistId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                >
                  <option value="">Select artist...</option>
                  {artists.map(a => (
                    <option key={a._id} value={a._id}>{a.artistName || a.stageName || a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Plan Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="e.g. Q1 2026 Development Plan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 h-20 resize-none"
                  placeholder="Plan description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Focus Areas (comma-separated)</label>
                <input
                  type="text"
                  value={newPlan.focusAreas}
                  onChange={(e) => setNewPlan({ ...newPlan, focusAreas: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
                  placeholder="e.g. Stage Performance, Branding, Social Media"
                />
              </div>
              <GoalEditor goals={newGoals} onChange={setNewGoals} />
            </div>
            <div className="flex items-center gap-3 justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowNewPlan(false)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-all duration-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button
                onClick={createPlan}
                disabled={creating || !newPlan.artistId || !newPlan.title}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditingPlan(null)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-xl p-6 dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Development Plan</h3>
              <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-gray-600 p-1 dark:text-gray-500 dark:hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Plan Title *</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as DevelopmentPlan['status'] }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-300">Focus Areas (comma-separated)</label>
                <input type="text" value={editForm.focusAreas} onChange={e => setEditForm(f => ({ ...f, focusAreas: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
              </div>
              <GoalEditor goals={editGoals} onChange={setEditGoals} />
            </div>
            <div className="flex items-center gap-3 justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setEditingPlan(null)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-all dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleUpdate} disabled={updating || !editForm.title} className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-50">
                {updating && <Loader2 size={14} className="animate-spin" />}
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 dark:bg-gray-900 dark:border dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Plan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to delete this development plan? This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition dark:text-gray-300 dark:hover:text-gray-100">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Development;
