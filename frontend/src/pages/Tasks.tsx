import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckSquare, Plus, Search, Clock, AlertTriangle, Users, Calendar,
  ChevronRight, ChevronDown, X, RefreshCw, ArrowRight, Target, Shield,
  Check, UserRound, Loader2, RotateCw, Send, MessageSquare, Activity,
} from 'lucide-react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { tasksApi } from '../services/api';
import type { Task, KanbanColumns, TeamMemberPerformance, TaskStats, User } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

const COLUMNS: { key: keyof KanbanColumns; label: string; color: string }[] = [
  { key: 'not_started', label: 'Not Started', color: '#6B7280' },
  { key: 'in_progress', label: 'In Progress', color: '#06B6D4' },
  { key: 'waiting_approval', label: 'Waiting Approval', color: '#F59E0B' },
  { key: 'blocked', label: 'Blocked', color: '#EF4444' },
  { key: 'delayed', label: 'Delayed', color: '#F59E0B' },
  { key: 'completed', label: 'Completed', color: '#10B981' },
];

const PRIORITY_COLORS: Record<string, string> = { low: '#6B7280', medium: '#06B6D4', high: '#F59E0B', critical: '#EF4444' };

const ROLE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Administrator', color: '#DC2626', bg: '#FEF2F2' },
  manager: { label: 'Manager', color: '#7C3AED', bg: '#F5F3FF' },
  artist: { label: 'Artist', color: '#0284C7', bg: '#F0F9FF' },
  finance: { label: 'Finance', color: '#B45309', bg: '#FFFBEB' },
  marketing: { label: 'Marketing', color: '#DB2777', bg: '#FDF2F8' },
};

const avatarColor = (name: string) => {
  const colors = ['#7C3AED', '#0284C7', '#059669', '#D97706', '#DC2626', '#DB2777', '#4F46E5', '#0D9488'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const initials = (name: string) => name?.split(' ').filter(Boolean).map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?';

const COLUMN_KEYS = COLUMNS.map(c => c.key) as (keyof KanbanColumns)[];

const emptyColumns = (): KanbanColumns => ({
  not_started: [], in_progress: [], waiting_approval: [], blocked: [], delayed: [], completed: [],
});

const cloneKanban = (kanban: KanbanColumns): KanbanColumns => {
  const built = emptyColumns();
  for (const key of COLUMN_KEYS) built[key] = [...(kanban[key] || [])];
  return built;
};

const findColumnOfTask = (kanban: KanbanColumns | null, taskId: string): keyof KanbanColumns | undefined => {
  if (!kanban) return undefined;
  return COLUMN_KEYS.find(key => (kanban[key] || []).some(task => task._id === taskId));
};

const findTaskInKanban = (kanban: KanbanColumns | null, taskId: string): Task | null => {
  if (!kanban) return null;
  for (const key of COLUMN_KEYS) {
    const found = (kanban[key] || []).find(task => task._id === taskId);
    if (found) return found;
  }
  return null;
};

const daysUntilDate = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

const TaskCardBody: React.FC<{ task: Task; compact?: boolean }> = ({ task, compact = false }) => {
  const days = daysUntilDate(task.deadline);
  const isOverdue = days < 0 && task.status !== 'completed';
  return (
    <>
      <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-gray-900 mb-1.5 leading-snug`}>{task.title}</div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${PRIORITY_COLORS[task.priority]}15`, color: PRIORITY_COLORS[task.priority] }}>
          {task.priority}
        </span>
        <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
          {task.status === 'completed' ? 'Done' : isOverdue ? `${Math.abs(days)}d late` : `${days}d`}
        </span>
      </div>
      {task.deliverable && (
        <div className="text-[10px] text-gray-400 truncate mb-1.5 flex items-center gap-1">
          <Target size={9} /> {task.deliverable}
        </div>
      )}
      {task.assignedTo && (
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-100">
          <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white" style={{ background: avatarColor(task.assignedTo.name) }}>
            {initials(task.assignedTo.name)}
          </div>
          <span className="text-[10px] text-gray-500 truncate">{task.assignedTo.name}</span>
        </div>
      )}
    </>
  );
};

interface SortableTaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
}

const SortableTaskCard: React.FC<SortableTaskCardProps> = ({ task, onOpen }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    data: { task },
  });
  const days = daysUntilDate(task.deadline);
  const isOverdue = days < 0 && task.status !== 'completed';
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 30 : undefined,
      }}
      className={`p-3 rounded-xl bg-white border shadow-sm hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200' : 'border-gray-100'} ${isDragging ? 'relative' : ''}`}
    >
      <TaskCardBody task={task} />
    </div>
  );
};

interface TaskColumnProps {
  col: { key: keyof KanbanColumns; label: string; color: string };
  tasks: Task[];
  onOpen: (task: Task) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ col, tasks, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, data: { status: col.key } });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-44 h-full rounded-xl flex flex-col gap-2.5 p-1 -m-1 transition-colors duration-150 ${isOver ? 'bg-indigo-50/80 ring-2 ring-indigo-300/70 ring-inset dark:bg-indigo-500/10 dark:ring-indigo-500/40' : ''}`}
    >
      <div className="flex items-center justify-between mb-0.5 px-2 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
          <span className="text-xs font-semibold text-gray-700">{col.label}</span>
        </div>
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
        <div className={`min-h-16 flex-1 rounded-lg space-y-2 px-2 py-1 transition-colors duration-150 ${isOver ? 'bg-indigo-100/50 dark:bg-indigo-500/10' : 'bg-transparent'}`}>
          {tasks.map(task => <SortableTaskCard key={task._id} task={task} onOpen={onOpen} />)}
          {tasks.length === 0 && (
            <div className={`text-[10px] text-gray-400 text-center py-4 border border-dashed rounded-lg transition-colors ${isOver ? 'border-indigo-300 bg-indigo-50/60 text-indigo-500 dark:border-indigo-500/50 dark:bg-indigo-500/10' : 'border-gray-200'}`}>
              Drop here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

interface AssigneeSelectProps {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  currentAssignee?: User;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

const AssigneeSelect: React.FC<AssigneeSelectProps> = ({ users, value, onChange, currentAssignee, loading, error, onRetry }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const selected = users.find(user => user._id === value)
    || (currentAssignee?._id === value ? currentAssignee : undefined);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = users.filter(user => !normalizedQuery
    || user.name.toLowerCase().includes(normalizedQuery)
    || user.email?.toLowerCase().includes(normalizedQuery)
    || user.role.toLowerCase().includes(normalizedQuery));

  const choose = (userId: string) => {
    onChange(userId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full min-h-11 flex items-center gap-3 px-3 py-2 bg-white border rounded-xl text-left transition-all dark:bg-gray-800 dark:text-gray-100 ${
          open ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-sm' : 'border-gray-300 hover:border-indigo-300 dark:border-gray-600'
        }`}
      >
        {loading ? (
          <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 dark:bg-indigo-500/10">
            <Loader2 size={15} className="animate-spin" />
          </span>
        ) : selected ? (
          <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm" style={{ background: avatarColor(selected.name) }}>
            {initials(selected.name)}
          </span>
        ) : (
          <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0 dark:bg-gray-700 dark:text-gray-300">
            <UserRound size={15} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-semibold truncate ${selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-300'}`}>
            {loading ? 'Loading team members...' : selected?.name || 'Select a team member'}
          </span>
          <span className="block text-[10px] text-gray-400 truncate dark:text-gray-500">
            {selected ? `${ROLE_STYLES[selected.role]?.label || selected.role}${selected.email ? ` · ${selected.email}` : ''}` : error || 'Currently unassigned'}
          </span>
        </span>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-gray-700 dark:bg-gray-900">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search name, email, or role..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-2" role="listbox">
            <button
              type="button"
              onClick={() => choose('')}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${!value ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center dark:bg-gray-800"><UserRound size={15} /></span>
              <span className="flex-1"><span className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Unassigned</span><span className="block text-[10px] text-gray-400">No team member is responsible</span></span>
              {!value && <Check size={15} className="text-indigo-600" />}
            </button>

            {loading && <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500"><Loader2 size={15} className="animate-spin text-indigo-500" /> Loading team members</div>}
            {!loading && error && (
              <div className="m-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900/60 dark:bg-amber-500/10">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Team members could not be loaded</p>
                <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">{error}</p>
                {onRetry && <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 shadow-sm ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-gray-900 dark:ring-amber-800"><RotateCw size={11} /> Retry</button>}
              </div>
            )}
            {!loading && !error && filteredUsers.map(user => {
              const role = ROLE_STYLES[user.role] || { label: user.role, color: '#4B5563', bg: '#F3F4F6' };
              const isSelected = value === user._id;
              return (
                <button key={user._id} type="button" onClick={() => choose(user._id)} role="option" aria-selected={isSelected}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-[10px] font-bold shadow-sm" style={{ background: avatarColor(user.name) }}>{initials(user.name)}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900 truncate dark:text-gray-100">{user.name}</span><span className="block text-[10px] text-gray-400 truncate">{user.email}</span></span>
                  <span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: role.color, background: role.bg }}>{role.label}</span>
                  {isSelected && <Check size={15} className="text-indigo-600 flex-shrink-0" />}
                </button>
              );
            })}
            {!loading && !error && filteredUsers.length === 0 && <div className="py-8 text-center"><Users size={22} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-medium text-gray-500">No matching team members</p></div>}
          </div>
        </div>
      )}
    </div>
  );
};

const Tasks: React.FC = () => {
  const { user, canAccess } = useAuth();
  const [searchParams] = useSearchParams();
  const openedTaskRef = useRef('');
  const canManageTasks = canAccess('tasks', 'write');
  const [kanban, setKanban] = useState<KanbanColumns | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMemberPerformance[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignableLoading, setAssignableLoading] = useState(true);
  const [assignableError, setAssignableError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'board' | 'list' | 'team'>('board');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const dragSnapshotRef = useRef<KanbanColumns | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [form, setForm] = useState({
    title: '', description: '', assignedTo: '', deadline: '', priority: 'medium',
    category: 'general', deliverable: '', notes: '',
  });

  const loadAssignableUsers = useCallback(async () => {
    if (!canManageTasks) {
      setAssignableLoading(false);
      setAssignableError('');
      return;
    }
    setAssignableLoading(true);
    setAssignableError('');
    try {
      const usersRes = await tasksApi.getAssignable();
      setUsers(usersRes.data.data || []);
    } catch (error: any) {
      setAssignableError(error.response?.data?.message || 'Check the task service and try again.');
    } finally {
      setAssignableLoading(false);
    }
  }, [canManageTasks]);

  const refreshData = useCallback(async (showError = false) => {
    setAssignableLoading(true);
    try {
      const [kanbanRes, tasksRes, teamRes, statsRes] = await Promise.all([
        tasksApi.getKanban(), tasksApi.getAll({ limit: 100 }),
        canManageTasks ? tasksApi.getTeam() : Promise.resolve(null), tasksApi.getStats(),
      ]);
      setKanban(kanbanRes.data.data);
      setTasks(tasksRes.data.data);
      setTeam(teamRes?.data.data || []);
      setStats(statsRes.data.data);
    } catch { if (showError) toast.error('Failed to load tasks'); }
    try {
      const usersRes = await tasksApi.getAssignable();
      setUsers(usersRes.data.data || []);
    } catch { setUsers([]); }
    setAssignableLoading(false);
  }, [canManageTasks]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await refreshData(true);
    setLoading(false);
  }, [refreshData]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId || openedTaskRef.current === taskId) return;
    openedTaskRef.current = taskId;
    tasksApi.getById(taskId)
      .then(response => setViewTask(response.data.data))
      .catch((error: any) => toast.error(error.response?.data?.message || 'Unable to open this task'));
  }, [searchParams]);

  const applyTaskUpdate = (updated: Task) => {
    setKanban(prev => {
      if (!prev) return prev;
      const cols = (Object.keys(prev) as (keyof KanbanColumns)[]);
      const built: Partial<KanbanColumns> = { not_started: [], in_progress: [], waiting_approval: [], blocked: [], delayed: [], completed: [] };
      for (const key of cols) built[key] = prev[key] ? [...prev[key]] : [];
      for (const key of cols) {
        const removedIndex = (built[key] || []).findIndex(t => t._id === updated._id);
        if (removedIndex >= 0) (built[key] || []).splice(removedIndex, 1);
      }
      (built[updated.status as keyof KanbanColumns] || built.not_started as KanbanColumns['not_started']).unshift(updated);
      return built as KanbanColumns;
    });
    setTasks(prev => prev.map(t => t._id === updated._id ? updated : t));
  };

  const applyTaskInPlace = (updated: Task) => {
    setKanban(prev => {
      if (!prev) return prev;
      const built = cloneKanban(prev);
      const target = built[updated.status as keyof KanbanColumns];
      const idx = target.findIndex(t => t._id === updated._id);
      if (idx < 0) {
        for (const key of COLUMN_KEYS) built[key] = built[key].filter(t => t._id !== updated._id);
        target.unshift(updated);
      } else {
        target[idx] = updated;
      }
      return built;
    });
    setTasks(prev => prev.map(t => t._id === updated._id ? updated : t));
  };

  const handleCreate = async () => {
    if (!form.title || !form.deadline) return toast.error('Title and deadline required');
    if (!form.deliverable) return toast.error('Deliverable is required');
    try {
      const response = await tasksApi.create(form);
      applyTaskUpdate(response.data.data);
      toast.success('Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', assignedTo: '', deadline: '', priority: 'medium', category: 'general', deliverable: '', notes: '' });
      refreshData();
      setActiveTab('board');
    } catch { toast.error('Failed to create task'); }
  };

  const persistStatus = async (taskId: string, newStatus: string, opts: { silent?: boolean; inPlace?: boolean; onError?: () => void } = {}) => {
    const { silent = false, inPlace = false, onError } = opts;
    try {
      const response = await tasksApi.update(taskId, { status: newStatus });
      if (inPlace) applyTaskInPlace(response.data.data);
      else applyTaskUpdate(response.data.data);
      setViewTask(previous => previous?._id === taskId ? { ...previous, ...response.data.data } : previous);
      if (!silent) toast.success('Task updated');
    } catch {
      onError?.();
      toast.error('Failed to update status');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (!kanban) return;
    const task = findTaskInKanban(kanban, event.active.id as string);
    if (task) {
      dragSnapshotRef.current = cloneKanban(kanban);
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const overCol = COLUMN_KEYS.includes(overId as keyof KanbanColumns)
      ? overId as keyof KanbanColumns
      : findColumnOfTask(kanban, overId);
    const activeCol = findColumnOfTask(kanban, activeId);
    if (!overCol || !activeCol || activeCol === overCol) return;

    setKanban(prev => {
      if (!prev) return prev;
      const built = cloneKanban(prev);
      const fromIndex = built[activeCol].findIndex(t => t._id === activeId);
      if (fromIndex < 0) return prev;
      const [moved] = built[activeCol].splice(fromIndex, 1);
      const target = built[overCol];
      let insertIndex = target.findIndex(t => t._id === overId);
      if (insertIndex < 0) insertIndex = target.length;
      target.splice(insertIndex, 0, moved);
      return built;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;

    if (!over || !snapshot) {
      if (snapshot) setKanban(snapshot);
      return;
    }
    const activeId = active.id as string;
    const overId = over.id as string;

    const overCol = COLUMN_KEYS.includes(overId as keyof KanbanColumns)
      ? overId as keyof KanbanColumns
      : findColumnOfTask(kanban, overId) ?? findColumnOfTask(snapshot, overId);
    if (!overCol) {
      setKanban(snapshot);
      return;
    }

    const homeCol = findColumnOfTask(snapshot, activeId);
    const homeTask = findTaskInKanban(snapshot, activeId);
    if (!homeCol || !homeTask) return;

    if (overCol === homeCol) {
      if (overId !== overCol && overId !== activeId) {
        setKanban(prev => {
          if (!prev) return prev;
          const built = cloneKanban(prev);
          const arr = built[overCol];
          const from = arr.findIndex(t => t._id === activeId);
          let to = arr.findIndex(t => t._id === overId);
          if (from < 0 || to < 0 || from === to) return prev;
          const [moved] = arr.splice(from, 1);
          arr.splice(to > from ? to - 1 : to, 0, moved);
          return built;
        });
      }
      return;
    }

    if (findColumnOfTask(kanban, activeId) !== overCol) {
      applyTaskUpdate({ ...homeTask, status: overCol });
    }
    persistStatus(activeId, overCol, {
      silent: true,
      inPlace: true,
      onError: () => setKanban(snapshot),
    });
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    if (dragSnapshotRef.current) setKanban(dragSnapshotRef.current);
    dragSnapshotRef.current = null;
  };

  const handleAssignChange = async (taskId: string, userId: string) => {
    try {
      const response = await tasksApi.update(taskId, { assignedTo: userId || null });
      applyTaskUpdate(response.data.data);
      setViewTask(previous => previous ? { ...previous, ...response.data.data } : previous);
      toast.success(userId ? 'Task assigned' : 'Task unassigned');
    } catch (error: any) { toast.error(error.response?.data?.message || 'Failed to update assignee'); }
  };

  const handleAddComment = async () => {
    const message = comment.trim();
    if (!viewTask || !message || sendingComment) return;
    setSendingComment(true);
    try {
      const response = await tasksApi.addComment(viewTask._id, message);
      setViewTask(response.data.data);
      setComment('');
      toast.success('Message sent');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingComment(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.delete(id);
      toast.success('Task deleted');
      setViewTask(null);
      setKanban(prev => {
        if (!prev) return prev;
        const cols = (Object.keys(prev) as (keyof KanbanColumns)[]);
        const built: Partial<KanbanColumns> = { not_started: [], in_progress: [], waiting_approval: [], blocked: [], delayed: [], completed: [] };
        for (const key of cols) built[key] = (prev[key] || []).filter(t => t._id !== id);
        return built as KanbanColumns;
      });
      setTasks(prev => prev.filter(t => t._id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const getAvatarColor = (name: string) => {
    const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={24} className="text-indigo-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: '#8B5CF6', icon: <CheckSquare size={16} /> },
            { label: 'Overdue', value: stats.overdue, color: '#EF4444', icon: <Clock size={16} /> },
            { label: 'Due This Week', value: stats.dueThisWeek, color: '#F59E0B', icon: <Calendar size={16} /> },
            { label: 'Blocked', value: stats.byStatus['blocked'] || 0, color: '#F59E0B', icon: <Shield size={16} /> },
            { label: 'Completed', value: stats.byStatus['completed'] || 0, color: '#10B981', icon: <CheckSquare size={16} /> },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-all">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <span style={{ color: s.color }}>{s.icon}</span>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['board', 'list', ...(canManageTasks ? ['team'] : [])] as Array<'board' | 'list' | 'team'>).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab === 'team' ? 'Team' : tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
            <option value="">All Priority</option>
            {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {canManageTasks && (
            <button onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
              <Plus size={14} /> New Task
            </button>
          )}
        </div>
      </div>

      {/* Board View */}
      {activeTab === 'board' && kanban && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {COLUMNS.map(col => {
              const colTasks = (kanban[col.key] || []).filter(t => {
                const ms = !search || t.title.toLowerCase().includes(search.toLowerCase());
                const mp = !priorityFilter || t.priority === priorityFilter;
                return ms && mp;
              });
              return <TaskColumn key={col.key} col={col} tasks={colTasks} onOpen={task => setViewTask(task)} />;
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className="p-3 rounded-xl bg-white border border-indigo-300 shadow-2xl rotate-2 opacity-95 pointer-events-none w-56">
                <TaskCardBody task={activeTask} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {activeTab === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Task', 'Deliverable', 'Assignee', 'Deadline', 'Status', 'Priority'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(t => {
                const days = daysUntil(t.deadline);
                const isOverdue = days < 0 && t.status !== 'completed';
                return (
                  <tr key={t._id} onClick={() => setViewTask(t)} className="hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{t.title}</div>
                      {t.description && <div className="text-xs text-gray-500 truncate max-w-xs">{t.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 flex items-center gap-1"><Target size={10} /> {t.deliverable || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white" style={{ background: getAvatarColor(t.assignedTo.name) }}>{getInitials(t.assignedTo.name)}</div>
                          <span className="text-xs text-gray-600">{t.assignedTo.name}</span>
                        </div>
                      ) : <span className="text-xs text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{new Date(t.deadline).toLocaleDateString()}</div>
                      <div className={`text-[10px] font-bold ${isOverdue ? 'text-red-600' : days <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {isOverdue ? `${Math.abs(days)}d late` : `${days}d left`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: COLUMNS.find(c => c.key === t.status)?.color + '15', color: COLUMNS.find(c => c.key === t.status)?.color }}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
                        style={{ background: `${PRIORITY_COLORS[t.priority]}15`, color: PRIORITY_COLORS[t.priority] }}>{t.priority}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTasks.length === 0 && <div className="text-center py-12 text-gray-500 text-sm">No tasks found</div>}
        </div>
      )}

      {/* Team View */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Member', 'Total', 'Completed', 'In Progress', 'Delayed', 'Critical', 'Completion %', 'On-Time %'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m._id} className="hover:bg-gray-50 border-b border-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: getAvatarColor(m.name) }}>{getInitials(m.name)}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{m.role || 'team'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{m.total}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-semibold">{m.completed}</td>
                    <td className="px-4 py-3 text-sm text-cyan-600 font-semibold">{m.inProgress}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-semibold">{m.delayed}</td>
                    <td className="px-4 py-3 text-sm text-amber-600 font-semibold">{m.critical}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.completionRate}%`, background: m.completionRate >= 80 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444' }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: m.completionRate >= 80 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444' }}>{m.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${m.onTimeRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-indigo-600">{m.onTimeRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.length === 0 && <div className="text-center py-12 text-gray-500 text-sm">No team data yet</div>}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {viewTask && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setViewTask(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] shadow-2xl overflow-hidden flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{viewTask.title}</h3>
                <p className="text-xs text-gray-500 capitalize dark:text-gray-400">{viewTask.category} · {viewTask.priority} priority</p>
              </div>
              <button onClick={() => setViewTask(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400 dark:text-gray-500">Status</p>
                  <select value={viewTask.status} onChange={e => { persistStatus(viewTask._id, e.target.value); setViewTask({ ...viewTask, status: e.target.value as any }); }}
                    className="w-full mt-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div><p className="text-xs text-gray-400 dark:text-gray-500">Deadline</p><p className="text-sm font-medium text-gray-900 mt-1 dark:text-gray-100">{new Date(viewTask.deadline).toLocaleDateString()}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-400 dark:text-gray-500">Assignee</p>
                  {canManageTasks ? (
                    <div className="mt-1">
                      <AssigneeSelect
                        users={users}
                        value={viewTask.assignedTo?._id || ''}
                        currentAssignee={viewTask.assignedTo}
                        onChange={userId => handleAssignChange(viewTask._id, userId)}
                        loading={assignableLoading}
                        error={assignableError}
                        onRetry={loadAssignableUsers}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800">
                      <span className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-[10px] font-bold" style={{ background: avatarColor(viewTask.assignedTo?.name || '') }}>{initials(viewTask.assignedTo?.name || '')}</span>
                      <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{viewTask.assignedTo?.name || 'Unassigned'}</p><p className="text-[10px] text-gray-400">Task owner</p></div>
                    </div>
                  )}
                </div>
                <div className="col-span-2"><p className="text-xs text-gray-400 dark:text-gray-500">Deliverable</p><p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-1 dark:text-gray-100"><Target size={12} /> {viewTask.deliverable || '—'}</p></div>
              </div>
              {viewTask.description && <div><p className="text-xs text-gray-400 mb-1 dark:text-gray-500">Description</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 dark:text-gray-200 dark:bg-gray-800">{viewTask.description}</p></div>}
              {viewTask.notes && <div><p className="text-xs text-gray-400 mb-1 dark:text-gray-500">Notes</p><p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 dark:text-gray-200 dark:bg-gray-800">{viewTask.notes}</p></div>}

              <div className="rounded-2xl border border-gray-200 overflow-hidden dark:border-gray-700">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/70">
                  <div className="flex items-center gap-2"><MessageSquare size={15} className="text-indigo-600" /><h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">Messages</h4></div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">{viewTask.comments?.length || 0}</span>
                </div>
                <div className="max-h-60 space-y-3 overflow-y-auto p-4 bg-white dark:bg-gray-900">
                  {!viewTask.comments?.length ? (
                    <div className="py-5 text-center"><MessageSquare size={24} className="mx-auto text-gray-300" /><p className="mt-2 text-xs font-semibold text-gray-500">No messages yet</p><p className="mt-0.5 text-[10px] text-gray-400">Start the conversation about this task.</p></div>
                  ) : viewTask.comments.map(item => {
                    const own = item.author?._id === user?._id;
                    return (
                      <div key={item._id} className={`flex gap-2.5 ${own ? 'flex-row-reverse' : ''}`}>
                        <span className="w-7 h-7 rounded-lg text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: avatarColor(item.author?.name || '') }}>{initials(item.author?.name || '')}</span>
                        <div className={`max-w-[78%] ${own ? 'text-right' : ''}`}>
                          <div className={`flex items-center gap-2 ${own ? 'justify-end' : ''}`}><span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{item.author?.name || 'Team member'}</span><span className="text-[9px] text-gray-400">{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                          <p className={`mt-1 rounded-2xl px-3 py-2 text-left text-xs leading-relaxed ${own ? 'rounded-tr-md bg-indigo-600 text-white' : 'rounded-tl-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{item.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70">
                  <div className="flex items-end gap-2">
                    <textarea value={comment} onChange={event => setComment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleAddComment(); } }} maxLength={2000} rows={2} placeholder="Write a message... Use Shift+Enter for a new line"
                      className="min-h-11 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    <button type="button" onClick={handleAddComment} disabled={!comment.trim() || sendingComment} title="Send message"
                      className="h-11 w-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                      {sendingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[9px] text-gray-400">Enter to send · Shift+Enter for a new line</p>
                </div>
              </div>

              {!!viewTask.activity?.length && (
                <div>
                  <div className="mb-2 flex items-center gap-2"><Activity size={14} className="text-gray-400" /><h4 className="text-xs font-bold text-gray-600 dark:text-gray-300">Recent activity</h4></div>
                  <div className="space-y-2 border-l-2 border-gray-100 pl-3 dark:border-gray-800">
                    {viewTask.activity.slice(-5).reverse().map(item => <div key={item._id} className="text-[10px] text-gray-500 dark:text-gray-400"><b className="text-gray-700 dark:text-gray-200">{item.actor?.name || 'Team member'}</b> {item.message || item.action.replace(/_/g, ' ')} <span className="text-gray-400">· {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              {canManageTasks && <button onClick={() => setDeleteTarget(viewTask._id)} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10">Delete</button>}
              <button onClick={() => setViewTask(null)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[85vh] overflow-y-auto dark:bg-gray-900 dark:border dark:border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Task</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Deliverable * <span className="text-gray-400 font-normal">(what will be delivered)</span></label>
                <input value={form.deliverable} onChange={e => setForm(p => ({ ...p, deliverable: e.target.value }))} placeholder="e.g. Final mix sent to distributor"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Deadline *</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Assign To</label>
                  <AssigneeSelect
                    users={users}
                    value={form.assignedTo}
                    onChange={userId => setForm(previous => ({ ...previous, assignedTo: userId }))}
                    loading={assignableLoading}
                    error={assignableError}
                    onRetry={loadAssignableUsers}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                  {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                  {['general', 'production', 'marketing', 'finance', 'legal', 'distribution'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block dark:text-gray-300">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreate} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create Task</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Tasks;
