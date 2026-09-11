import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  ArrowLeft, Award, Plus, CheckCircle, Circle, X,
  ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { developmentApi } from '../services/api';
import type { ArtistProgressData, SkillRatings, MetricScores } from '../types';
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

const METRIC_LABELS: Record<keyof MetricScores, string> = {
  songsCompleted: 'Songs Completed',
  contentPosted: 'Content Posted',
  engagementGrowth: 'Engagement Growth (%)',
  rehearsalsCompleted: 'Rehearsals Done',
  deadlinesMet: 'Deadlines Met',
  revenueGenerated: 'Revenue Generated',
  audienceGrowth: 'Audience Growth (%)',
  teamCooperation: 'Team Cooperation',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const defaultSkillRatings = (): SkillRatings => ({
  musicQuality: 5,
  songwriting: 5,
  vocalAbility: 5,
  stagePerformance: 5,
  branding: 5,
  visualIdentity: 5,
  socialMediaConsistency: 5,
  interviewSkills: 5,
  fanEngagement: 5,
  professionalBehavior: 5,
});

const defaultMetricScores = (): MetricScores => ({
  songsCompleted: 0,
  contentPosted: 0,
  engagementGrowth: 0,
  rehearsalsCompleted: 0,
  deadlinesMet: 0,
  revenueGenerated: 0,
  audienceGrowth: 0,
  teamCooperation: 5,
});

const scorecardTime = (month: string, year: number): number => {
  const namedMonth = MONTHS.indexOf(String(month));
  const legacyMonth = Number(month);
  const monthIndex = namedMonth >= 0
    ? namedMonth
    : Number.isInteger(legacyMonth) && legacyMonth >= 0 && legacyMonth <= 11
    ? legacyMonth
    : 0;
  return new Date(year, monthIndex, 1).getTime();
};

interface RatingInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function RatingInput({ label, value, onChange }: RatingInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">{label}</label>
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = n <= value;
          let color = 'bg-gray-200 text-gray-400';
          if (active) {
            if (n >= 7) color = 'bg-emerald-500 text-white';
            else if (n >= 5) color = 'bg-amber-400 text-white';
            else color = 'bg-red-400 text-white';
          }
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${color} hover:scale-110`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ArtistScorecard() {
  const { artistId } = useParams<{ artistId: string }>();
  const navigate = useNavigate();

  const [progress, setProgress] = useState<ArtistProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showNewScorecard, setShowNewScorecard] = useState(false);

  const [newMonth, setNewMonth] = useState<number>(new Date().getMonth());
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [newSkills, setNewSkills] = useState<SkillRatings>(defaultSkillRatings());
  const [newMetrics, setNewMetrics] = useState<MetricScores>(defaultMetricScores());
  const [newGoals, setNewGoals] = useState<{ title: string; completed: boolean }[]>([
    { title: '', completed: false },
  ]);
  const [newImprovements, setNewImprovements] = useState('');
  const [newComments, setNewComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    try {
      const res = await developmentApi.getArtistProgress(artistId);
      setProgress(res.data.data);
    } catch {
      toast.error('Failed to load scorecard data');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scorecards = [...(progress?.scorecards ?? [])].sort(
    (a, b) => scorecardTime(b.month, b.year) - scorecardTime(a.month, a.year)
  );
  const summary = progress?.summary;
  const hasData = !!summary && scorecards.length > 0;

  const getOverallScore = (skills: SkillRatings): number => {
    const vals = Object.values(skills);
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const skillAverages = (): { skill: string; value: number }[] => {
    if (!hasData) return [];
    const acc: Record<string, number[]> = {};
    Object.keys(SKILL_LABELS).forEach((k) => (acc[k] = []));
    scorecards.forEach((sc) => {
      Object.keys(sc.skillRatings).forEach((k) => {
        acc[k]?.push((sc.skillRatings as any)[k]);
      });
    });
    return Object.entries(SKILL_LABELS).map(([key, label]) => ({
      skill: label,
      value: +(acc[key].reduce((a, b) => a + b, 0) / acc[key].length).toFixed(1),
    }));
  };

  const scoreHistory = [...scorecards].reverse().map((sc) => ({
    label: `${String(sc.month).slice(0, 3)} ${sc.year}`,
    score: getOverallScore(sc.skillRatings),
  }));

  const growthData = (() => {
    if (scorecards.length < 2) return [];
    const latest = scorecards[0];
    const prev = scorecards[1];
    return Object.keys(SKILL_LABELS).map((key) => ({
      label: SKILL_LABELS[key as keyof SkillRatings],
      delta:
        (latest.skillRatings as any)[key] - (prev.skillRatings as any)[key],
    }));
  })();

  const bestSkill = (() => {
    if (!hasData) return '—';
    const avgs = skillAverages();
    return avgs.reduce((best, cur) => (cur.value > best.value ? cur : best), avgs[0])?.skill ?? '—';
  })();

  const weakestSkill = (() => {
    if (!hasData) return '—';
    const avgs = skillAverages();
    return avgs.reduce((worst, cur) => (cur.value < worst.value ? cur : worst), avgs[0])?.skill ?? '—';
  })();

  const growthTrend = (() => {
    if (scorecards.length < 2) return '—';
    const latest = getOverallScore(scorecards[0].skillRatings);
    const prev = getOverallScore(scorecards[1].skillRatings);
    const diff = +(latest - prev).toFixed(1);
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
  })();

  const overallScore = hasData ? getOverallScore(scorecards[0].skillRatings) : 0;

  const scoreColor = (s: number) => {
    if (s >= 7) return 'text-emerald-600';
    if (s >= 5) return 'text-amber-600';
    return 'text-red-500';
  };

  const handleSubmit = async () => {
    if (!artistId || !progress?.plans?.length) return;
    setSubmitting(true);
    try {
      const goals = newGoals
        .filter((g) => g.title.trim())
        .map((g) => ({ title: g.title.trim(), completed: g.completed }));
      const improvements = newImprovements
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      await developmentApi.addScorecard(progress.plans[0]._id, {
        month: MONTHS[newMonth],
        year: newYear,
        skillRatings: newSkills,
        metricScores: newMetrics,
        goals,
        improvements,
        comments: newComments.trim(),
      });
      toast.success('Scorecard added');
      setShowNewScorecard(false);
      resetNewForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add scorecard');
    } finally {
      setSubmitting(false);
    }
  };

  const resetNewForm = () => {
    setNewMonth(new Date().getMonth());
    setNewYear(new Date().getFullYear());
    setNewSkills(defaultSkillRatings());
    setNewMetrics(defaultMetricScores());
    setNewGoals([{ title: '', completed: false }]);
    setNewImprovements('');
    setNewComments('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!progress || progress.plans.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate('/development')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-8 transition"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Development</span>
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <Award size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            No Development Plan Found
          </h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create a development plan first to start tracking scorecards for
            this artist.
          </p>
          <button
            onClick={() => navigate('/development')}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <ArrowLeft size={16} />
            Go to Development Plans
          </button>
        </div>
      </div>
    );
  }

  const radarData = skillAverages();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: getAvatarColor(artistId ?? '') }}
          >
            {((progress as any)?.plans?.[0]?.artistId?.name
              ? getInitials((progress as any).plans[0].artistId.name)
              : '?')}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {(progress as any)?.plans?.[0]?.artistId?.name ?? 'Artist'}
            </h1>
            <p className="text-sm text-gray-500">Development Scorecard</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewScorecard(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          Add Scorecard
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          {
            label: 'Overall Score',
            value: hasData ? `${overallScore}/10` : '—',
            color: hasData ? scoreColor(overallScore) : 'text-gray-400',
          },
          {
            label: 'Total Scorecards',
            value: scorecards.length,
            color: 'text-gray-900',
          },
          { label: 'Best Skill', value: bestSkill, color: 'text-emerald-600' },
          {
            label: 'Weakest Area',
            value: weakestSkill,
            color: 'text-red-500',
          },
          {
            label: 'Growth Trend',
            value: growthTrend,
            color: growthTrend.startsWith('+')
              ? 'text-emerald-600'
              : growthTrend === '—'
              ? 'text-gray-400'
              : 'text-red-500',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Radar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Skill Averages
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <PolarRadiusAxis
                domain={[0, 10]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <Radar
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Line */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Score History
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={scoreHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar — Growth */}
        {growthData.length > 0 && (
          <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Growth vs Previous Scorecard
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip />
                <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                  {growthData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.delta >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Scorecard History */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Scorecard History
        </h2>
        <div className="space-y-3">
          {scorecards.map((sc, idx) => {
            const expanded = expandedIndex === idx;
            const overall = getOverallScore(sc.skillRatings);
            return (
              <div
                key={sc._id ?? idx}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedIndex(expanded ? null : idx)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-gray-800">
                      {String(sc.month)} {sc.year}
                    </span>
                    <span className="text-xs text-gray-400">
                      {sc.goals?.length ?? 0} goals
                    </span>
                    <span className="text-xs text-gray-400">
                      {sc.improvements?.length ?? 0} improvements
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg font-bold ${scoreColor(overall)}`}
                    >
                      {overall}
                    </span>
                    {expanded ? (
                      <ChevronUp size={18} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-gray-200 px-6 py-6 grid grid-cols-2 gap-8">
                    {/* Skills */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-3 dark:text-gray-400">
                        Skill Ratings
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(SKILL_LABELS).map(([key, label]) => {
                          const val = (sc.skillRatings as any)[key] as number;
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-sm mb-0.5">
                                <span className="text-gray-700">{label}</span>
                                <span className={`font-semibold ${scoreColor(val)}`}>
                                  {val}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    val >= 7
                                      ? 'bg-emerald-500'
                                      : val >= 5
                                      ? 'bg-amber-400'
                                      : 'bg-red-400'
                                  }`}
                                  style={{ width: `${val * 10}%` }}
                                />
                              </div>
                            </div>
                          );
          })}
          {scorecards.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Award size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">No scorecards yet</p>
              <p className="text-xs text-gray-500">Add a scorecard to start tracking this artist's development.</p>
            </div>
          )}
                      </div>
                    </div>

                    {/* Metrics & extras */}
                    <div className="space-y-6">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
                        Metric Scores
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(METRIC_LABELS).map(([key, label]) => (
                          <div
                            key={key}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-100"
                          >
                            <p className="text-xs text-gray-500 mb-0.5">
                              {label}
                            </p>
                            <p className="text-lg font-bold text-gray-800">
                              {(sc.metricScores as any)[key]}
                            </p>
                          </div>
                        ))}
                      </div>

                      {sc.comments && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-1">
                            Comments
                          </h4>
                          <p className="text-sm text-gray-700 whitespace-pre-line">
                            {sc.comments}
                          </p>
                        </div>
                      )}

                      {sc.improvements?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-1">
                            Improvements
                          </h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {sc.improvements.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sc.goals?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-1">
                            Goals
                          </h4>
                          <ul className="space-y-1">
                            {sc.goals.map((g, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-sm text-gray-700"
                              >
                                {g.completed ? (
                                  <CheckCircle
                                    size={14}
                                    className="text-emerald-500 flex-shrink-0"
                                  />
                                ) : (
                                  <Circle
                                    size={14}
                                    className="text-gray-300 flex-shrink-0"
                                  />
                                )}
                                <span
                                  className={
                                    g.completed
                                      ? 'line-through text-gray-400'
                                      : ''
                                  }
                                >
                                  {g.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Scorecard Modal */}
      {showNewScorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900 dark:border dark:border-gray-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10 dark:bg-gray-900 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                New Scorecard
              </h2>
              <button
                onClick={() => {
                  setShowNewScorecard(false);
                  resetNewForm();
                }}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition dark:text-gray-500 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Month & Year */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Month
                  </label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(+e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Year
                  </label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(+e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Skill Ratings */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-3 dark:text-gray-400">
                  Skill Ratings
                </h3>
                <div className="space-y-4">
                  {(Object.keys(SKILL_LABELS) as (keyof SkillRatings)[]).map(
                    (key) => (
                      <RatingInput
                        key={key}
                        label={SKILL_LABELS[key]}
                        value={newSkills[key]}
                        onChange={(v) =>
                          setNewSkills((prev) => ({ ...prev, [key]: v }))
                        }
                      />
                    )
                  )}
                </div>
              </div>

              {/* Metric Scores */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400 mb-3 dark:text-gray-400">
                  Metric Scores
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(METRIC_LABELS) as (keyof MetricScores)[]).map(
                    (key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                          {METRIC_LABELS[key]}
                        </label>
                        <input
                          type="number"
                          min={key === 'teamCooperation' ? 1 : 0}
                          max={key === 'teamCooperation' ? 10 : undefined}
                          value={newMetrics[key]}
                          onChange={(e) =>
                            setNewMetrics((prev) => ({
                              ...prev,
                              [key]: +e.target.value,
                            }))
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Goals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
                    Goals
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setNewGoals((prev) => [
                        ...prev,
                        { title: '', completed: false },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition"
                  >
                    <Plus size={14} />
                    Add Goal
                  </button>
                </div>
                <div className="space-y-2">
                  {newGoals.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Goal title"
                        value={g.title}
                        onChange={(e) =>
                          setNewGoals((prev) =>
                            prev.map((item, j) =>
                              j === i ? { ...item, title: e.target.value } : item
                            )
                          )
                        }
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      />
                      <input
                        type="checkbox"
                        checked={g.completed}
                        onChange={(e) =>
                          setNewGoals((prev) =>
                            prev.map((item, j) =>
                              j === i
                                ? { ...item, completed: e.target.checked }
                                : item
                            )
                          )
                        }
                        className="h-4 w-4 rounded text-indigo-600"
                      />
                      {newGoals.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewGoals((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="p-1 text-gray-400 hover:text-red-500 transition"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Improvements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Improvements (one per line)
                </label>
                <textarea
                  value={newImprovements}
                  onChange={(e) => setNewImprovements(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  placeholder="Improved vocal range&#10;Better stage presence"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Comments
                </label>
                <textarea
                  value={newComments}
                  onChange={(e) => setNewComments(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  placeholder="General notes about this period..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white dark:bg-gray-900 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowNewScorecard(false);
                  resetNewForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition dark:text-gray-300 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Save size={16} />
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
