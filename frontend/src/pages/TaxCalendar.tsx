import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, Search, Edit2, Trash2, Clock, AlertTriangle, CheckCircle,
  XCircle, ChevronLeft, ChevronRight, FileText, Bell, Repeat, MapPin, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatDate, getStatusClass, formatStatus, daysUntil } from '../utils/helpers';

interface TaxCalendarEvent {
  _id: string;
  title: string;
  description: string;
  type: 'tax_filing' | 'estimated_tax' | 'tax_deadline' | 'tax_return' | 'audit' | 'compliance' | 'other';
  dueDate: string;
  status: 'upcoming' | 'completed' | 'overdue' | 'extended';
  priority: 'low' | 'medium' | 'high' | 'critical';
  year: number;
  quarter?: number;
  month?: number;
  amount?: number;
  notes: string;
  assignedTo?: string;
  recurring: boolean;
  recurringFrequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  completedAt?: string;
  completedBy?: string;
  documents: Array<{ name: string; url: string; uploadedAt: string }>;
  reminders: Array<{ daysBefore: number; notified: boolean; notifiedAt?: string }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  tax_filing: { label: 'Tax Filing', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', dot: 'bg-indigo-500' },
  estimated_tax: { label: 'Estimated Tax', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-500' },
  tax_deadline: { label: 'Tax Deadline', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', dot: 'bg-red-500' },
  tax_return: { label: 'Tax Return', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-500' },
  audit: { label: 'Audit', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', dot: 'bg-rose-500' },
  compliance: { label: 'Compliance', color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-900/20', dot: 'bg-sky-500' },
  other: { label: 'Other', color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20', dot: 'bg-gray-500' },
};

const priorityBorder: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-amber-500',
  medium: 'border-l-blue-500',
  low: 'border-l-gray-400',
};

const emptyEvent: Partial<TaxCalendarEvent> = {
  title: '',
  description: '',
  type: 'tax_filing',
  dueDate: '',
  status: 'upcoming',
  priority: 'medium',
  year: new Date().getFullYear(),
  quarter: undefined,
  month: undefined,
  amount: undefined,
  notes: '',
  assignedTo: '',
  recurring: false,
  recurringFrequency: undefined,
  tags: [],
};

const TaxCalendar: React.FC = () => {
  const [events, setEvents] = useState<TaxCalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<TaxCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<TaxCalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TaxCalendarEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<TaxCalendarEvent> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [tagsInput, setTagsInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const [allRes, upcomingRes] = await Promise.all([
        api.get('/tax-calendar'),
        api.get('/tax-calendar/upcoming'),
      ]);
      if (allRes.data.success) setEvents(allRes.data.data);
      if (upcomingRes.data.success) setUpcomingEvents(upcomingRes.data.data);
    } catch (err) {
      toast.error('Failed to load tax calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const now = new Date();
  const totalEvents = events.length;
  const upcomingCount = events.filter(e => {
    const days = daysUntil(e.dueDate);
    return days >= 0 && days <= 30 && e.status !== 'completed';
  }).length;
  const overdueCount = events.filter(e => {
    return daysUntil(e.dueDate) < 0 && e.status !== 'completed';
  }).length;
  const completedCount = events.filter(e => e.status === 'completed').length;

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startPad = firstDay.getDay();
    for (let i = startPad - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  };

  const formatDateKey = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getEventsForDate = (dateKey: string): TaxCalendarEvent[] => {
    return events.filter(e => {
      const eventDate = e.dueDate.split('T')[0];
      return eventDate === dateKey;
    });
  };

  const handleDayClick = (date: Date) => {
    const key = formatDateKey(date);
    setSelectedDate(key);
    setSelectedDayEvents(getEventsForDate(key));
  };

  const handleEventClick = (event: TaxCalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleCreate = () => {
    setEditingEvent({ ...emptyEvent });
    setIsEditing(false);
    setTagsInput('');
    setShowModal(true);
  };

  const handleEdit = (event: TaxCalendarEvent) => {
    setEditingEvent({ ...event });
    setIsEditing(true);
    setTagsInput(event.tags.join(', '));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editingEvent?.title || !editingEvent?.dueDate) {
      toast.error('Title and due date are required');
      return;
    }
    try {
      const payload = {
        ...editingEvent,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (isEditing && editingEvent._id) {
        await api.put(`/tax-calendar/${editingEvent._id}`, payload);
        toast.success('Event updated');
      } else {
        await api.post('/tax-calendar', payload);
        toast.success('Event created');
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      toast.error('Failed to save event');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/tax-calendar/${id}`);
      toast.success('Event deleted');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      toast.error('Failed to delete event');
    }
  };

  const handleMarkComplete = async (event: TaxCalendarEvent) => {
    try {
      await api.put(`/tax-calendar/${event._id}`, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      toast.success('Event marked as completed');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err) {
      toast.error('Failed to update event');
    }
  };

  const days = getDaysInMonth(currentMonth);
  const monthLabel = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const filteredEvents = events
    .filter(e => {
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'overdue': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'extended': return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <AlertCircle className="w-4 h-4 text-cyan-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tax Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage tax deadlines, filings, and compliance events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              List
            </button>
          </div>
          <button
            onClick={handleCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Events</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalEvents}</p>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{upcomingCount}</p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Overdue</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{overdueCount}</p>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</p>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {view === 'calendar' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 dark:bg-gray-900 p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {day}
              </div>
            ))}
            {days.map((date, idx) => {
              const key = formatDateKey(date);
              const dayEvents = getEventsForDate(key);
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
              const isToday = formatDateKey(date) === formatDateKey(now);
              const isSelected = selectedDate === key;
              const hasOverdue = dayEvents.some(e => daysUntil(e.dueDate) < 0 && e.status !== 'completed');
              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(date)}
                  className={`bg-white dark:bg-gray-800 p-2 min-h-[80px] cursor-pointer transition-colors ${
                    !isCurrentMonth ? 'opacity-40' : ''
                  } ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500 ring-inset' : ''} ${
                    hasOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''
                  } hover:bg-gray-50 dark:hover:bg-gray-750`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      isToday
                        ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : isCurrentMonth
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dayEvents.slice(0, 3).map((event, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${typeConfig[event.type]?.dot || 'bg-gray-400'}`}
                        title={event.title}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="mt-1">
                      {dayEvents.slice(0, 1).map((event, i) => (
                        <p key={i} className="text-[10px] text-gray-600 dark:text-gray-400 truncate leading-tight">
                          {event.title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'calendar' && selectedDate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Events for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No events on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map(event => (
                <div
                  key={event._id}
                  onClick={() => handleEventClick(event)}
                  className={`p-3 rounded-lg border-l-4 ${priorityBorder[event.priority]} ${typeConfig[event.type]?.bg} cursor-pointer hover:shadow-sm transition-shadow`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {renderStatusIcon(event.status)}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig[event.type]?.bg} ${typeConfig[event.type]?.color} font-medium`}>
                        {typeConfig[event.type]?.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusClass(event.status)}`}>
                        {formatStatus(event.status)}
                      </span>
                    </div>
                  </div>
                  {event.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="extended">Extended</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Types</option>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No events found</p>
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map(event => {
                    const isOverdue = daysUntil(event.dueDate) < 0 && event.status !== 'completed';
                    return (
                      <tr
                        key={event._id}
                        onClick={() => handleEventClick(event)}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors ${
                          isOverdue ? 'bg-red-50/50 dark:bg-red-900/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1 h-8 rounded-full ${typeConfig[event.type]?.dot || 'bg-gray-400'}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                              {event.recurring && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                  <Repeat className="w-3 h-3" /> {event.recurringFrequency}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${typeConfig[event.type]?.bg} ${typeConfig[event.type]?.color} font-medium`}>
                            {typeConfig[event.type]?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className={`text-sm ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                            {formatDate(event.dueDate)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {daysUntil(event.dueDate) < 0
                              ? `${Math.abs(daysUntil(event.dueDate))} days overdue`
                              : daysUntil(event.dueDate) === 0
                                ? 'Due today'
                                : `${daysUntil(event.dueDate)} days left`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {renderStatusIcon(event.status)}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusClass(event.status)}`}>
                              {formatStatus(event.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            event.priority === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : event.priority === 'high' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                : event.priority === 'medium' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
                          }`}>
                            {event.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {event.amount ? formatCurrency(event.amount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEdit(event)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(event._id)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedEvent && !showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Event Details</h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`border-l-4 ${priorityBorder[selectedEvent.priority]} pl-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedEvent.title}</h3>
                    {selectedEvent.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedEvent.description}</p>
                    )}
                  </div>
                  {renderStatusIcon(selectedEvent.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full ${typeConfig[selectedEvent.type]?.bg} ${typeConfig[selectedEvent.type]?.color} font-medium`}>
                    {typeConfig[selectedEvent.type]?.label}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full ${getStatusClass(selectedEvent.status)}`}>
                    {formatStatus(selectedEvent.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</p>
                  <p className={`text-sm mt-1 ${
                    daysUntil(selectedEvent.dueDate) < 0 && selectedEvent.status !== 'completed'
                      ? 'text-red-600 dark:text-red-400 font-medium'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {formatDate(selectedEvent.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</p>
                  <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full capitalize ${
                    selectedEvent.priority === 'critical' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : selectedEvent.priority === 'high' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                        : selectedEvent.priority === 'medium' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
                  }`}>
                    {selectedEvent.priority}
                  </span>
                </div>
                {selectedEvent.amount !== undefined && selectedEvent.amount !== null && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(selectedEvent.amount)}</p>
                  </div>
                )}
                {selectedEvent.year && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Year</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{selectedEvent.year}</p>
                  </div>
                )}
                {selectedEvent.quarter && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quarter</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">Q{selectedEvent.quarter}</p>
                  </div>
                )}
                {selectedEvent.month && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Month</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                      {new Date(2024, selectedEvent.month - 1).toLocaleString('en-US', { month: 'long' })}
                    </p>
                  </div>
                )}
                {selectedEvent.assignedTo && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assigned To</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{selectedEvent.assignedTo}</p>
                  </div>
                )}
              </div>

              {selectedEvent.recurring && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm text-indigo-700 dark:text-indigo-300">
                    Recurring {selectedEvent.recurringFrequency && `(${selectedEvent.recurringFrequency})`}
                  </span>
                </div>
              )}

              {selectedEvent.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.tags.map((tag, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 whitespace-pre-wrap">{selectedEvent.notes}</p>
                </div>
              )}

              {selectedEvent.documents.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Documents</p>
                  <div className="space-y-2">
                    {selectedEvent.documents.map((doc, i) => (
                      <a
                        key={i}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{doc.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.reminders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Reminders</p>
                  <div className="space-y-1">
                    {selectedEvent.reminders.map((rem, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Bell className={`w-3.5 h-3.5 ${rem.notified ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <span>{rem.daysBefore} days before</span>
                        {rem.notified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.completedAt && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  Completed on {formatDate(selectedEvent.completedAt)}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-5 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {selectedEvent.status !== 'completed' && (
                  <button
                    onClick={() => handleMarkComplete(selectedEvent)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Mark Complete
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget(selectedEvent._id)}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { handleEdit(selectedEvent); setSelectedEvent(null); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4 inline mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isEditing ? 'Edit Event' : 'Create Event'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editingEvent.title || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="e.g. Q2 Federal Tax Filing"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editingEvent.description || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Brief description..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                  <select
                    value={editingEvent.type || 'tax_filing'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value as TaxCalendarEvent['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {Object.entries(typeConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={editingEvent.dueDate ? editingEvent.dueDate.split('T')[0] : ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={editingEvent.priority || 'medium'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, priority: e.target.value as TaxCalendarEvent['priority'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={editingEvent.status || 'upcoming'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as TaxCalendarEvent['status'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="extended">Extended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                  <input
                    type="number"
                    value={editingEvent.year || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Quarter (optional)</label>
                  <select
                    value={editingEvent.quarter || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, quarter: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">None</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Month (optional)</label>
                  <select
                    value={editingEvent.month || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, month: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">None</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('en-US', { month: 'long' })}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    value={editingEvent.amount || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, amount: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={editingEvent.assignedTo || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Person or team"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingEvent.recurring || false}
                      onChange={(e) => setEditingEvent({
                        ...editingEvent,
                        recurring: e.target.checked,
                        recurringFrequency: e.target.checked ? 'annual' : undefined,
                      })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Recurring</span>
                  </label>
                  {editingEvent.recurring && (
                    <select
                      value={editingEvent.recurringFrequency || 'annual'}
                      onChange={(e) => setEditingEvent({ ...editingEvent, recurringFrequency: e.target.value as TaxCalendarEvent['recurringFrequency'] })}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semi_annual">Semi-Annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="federal, quarterly, payroll"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={editingEvent.notes || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {isEditing ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Event"
        message="Are you sure you want to delete this tax event? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default TaxCalendar;
