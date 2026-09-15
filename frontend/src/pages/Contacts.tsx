import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, User, Plus, Search, Building, Star, X, Edit3, Trash2, Calendar, MessageSquare, Clock, Check, ChevronRight, MapPin, Tag, FileText, ExternalLink, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { contactsApi } from '../services/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const categoryLabels: Record<string, string> = {
  a_and_r: 'A&R', manager: 'Manager', lawyer: 'Lawyer', accountant: 'Accountant',
  producer: 'Producer', engineer: 'Engineer', publicist: 'Publicist',
  radio_promoter: 'Radio Promoter', distribution: 'Distribution',
  streaming: 'Streaming', sync: 'Sync Licensing', brand: 'Brand Partnership',
  media: 'Media/Press', studio: 'Studio', touring: 'Touring', other: 'Other',
  dj: 'DJ', playlist_curator: 'Playlist Curator', journalist: 'Journalist',
  blogger: 'Blogger', podcaster: 'Podcaster', promoter: 'Promoter',
  venue_owner: 'Venue Owner', photographer: 'Photographer', videographer: 'Videographer',
  sync_agent: 'Sync Agent', music_supervisor: 'Music Supervisor',
  brand_representative: 'Brand Representative',
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  a_and_r: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  manager: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  lawyer: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  accountant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  producer: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  engineer: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  publicist: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  radio_promoter: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  distribution: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  streaming: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  sync: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  brand: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  media: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  studio: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  touring: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  other: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  dj: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  playlist_curator: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  journalist: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  blogger: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  podcaster: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  promoter: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  venue_owner: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  photographer: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  videographer: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  sync_agent: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  music_supervisor: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  brand_representative: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

const avatarColors = ['#7C3AED', '#F59E0B', '#8B5CF6', '#059669', '#DC2626', '#EC4899', '#0891B2', '#6366F1', '#D97706', '#10B981'];

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const getInitials = (name: string): string => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const interactionTypeIcons: Record<string, string> = {
  call: '📞', email: '📧', meeting: '🤝', message: '💬', event: '🎫', other: '📝',
};

const outcomeColors: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
  negative: 'bg-red-50 text-red-700 border border-red-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
};

const reminderTypeColors: Record<string, string> = {
  follow_up: 'bg-blue-50 text-blue-700 border border-blue-200',
  birthday: 'bg-pink-50 text-pink-700 border border-pink-200',
  contract_renewal: 'bg-amber-50 text-amber-700 border border-amber-200',
  meeting: 'bg-violet-50 text-violet-700 border border-violet-200',
  payment: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  other: 'bg-gray-50 text-gray-700 border border-gray-200',
};

const sourceLabels: Record<string, string> = {
  referral: 'Referral', website: 'Website', event: 'Event', social_media: 'Social Media',
  cold_outreach: 'Cold Outreach', existing: 'Existing', other: 'Other',
};

interface ContactData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  category: string;
  subcategory: string;
  address: { street: string; city: string; state: string; zipCode: string; country: string };
  socialLinks: { instagram: string; linkedin: string; twitter: string };
  relatedArtists: any[];
  relatedContracts: any[];
  interactions: ContactInteraction[];
  reminders: ContactReminder[];
  isFavorite: boolean;
  tags: string[];
  notes: string;
  lastContactedAt: string;
  lastContactNotes: string;
  followUpDate: string;
  whatWasSent: string;
  response: string;
  genrePreference: string;
  relationshipStatus: 'new' | 'contacted' | 'warm' | 'strong' | 'inactive' | 'archived';
  relationshipStrength: number;
  source: string;
  assignedTo: any;
  createdAt: string;
}

interface ContactInteraction {
  _id: string;
  type: string;
  subject: string;
  notes: string;
  date: string;
  outcome: string;
  whatWasSent: string;
  response: string;
  followUpRequired: boolean;
  followUpDate: string;
  createdBy: any;
}

interface ContactReminder {
  _id: string;
  title: string;
  date: string;
  type: string;
  notes: string;
  completed: boolean;
  completedAt: string;
}

interface Stats {
  total: number;
  favorites: number;
  byCategory: Record<string, number>;
  totalInteractions: number;
  totalReminders: number;
  upcomingRemindersCount: number;
  overdueFollowUps: number;
}

const emptyContact = {
  name: '', email: '', phone: '', company: '', role: '', category: 'other', subcategory: '',
  address: { street: '', city: '', state: '', zipCode: '', country: '' },
  socialLinks: { instagram: '', linkedin: '', twitter: '' },
  relatedArtists: [], relatedContracts: [], tags: [], notes: '', source: 'other', genrePreference: '', relationshipStatus: 'new' as const,
  relationshipStrength: 0, lastContactNotes: '', followUpDate: '', whatWasSent: '', response: '',
};

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('');
  const [showFollowUpsOnly, setShowFollowUpsOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactData | null>(null);
  const [editingContact, setEditingContact] = useState<Partial<ContactData>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'interactions' | 'reminders'>('overview');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [interactionForm, setInteractionForm] = useState({ type: 'call', subject: '', notes: '', outcome: 'neutral', date: '', whatWasSent: '', response: '', followUpRequired: false, followUpDate: '' });
  const [reminderForm, setReminderForm] = useState({ title: '', date: '', type: 'follow_up', notes: '' });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 50 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (relationshipFilter) params.relationshipStatus = relationshipFilter;
      if (showFollowUpsOnly) params.followUpDue = 'true';
      if (showFavoritesOnly) params.isFavorite = 'true';
      const res = await contactsApi.getAll(params);
      setContacts(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, relationshipFilter, showFollowUpsOnly, showFavoritesOnly, page]);

  const fetchStats = async () => {
    try {
      const res = await contactsApi.getStats();
      setStats(res.data.data);
    } catch (err) { toast.error('Failed to load contact stats'); }
  };

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    const handler = setTimeout(() => { setPage(1); }, 300);
    return () => clearTimeout(handler);
  }, [search, categoryFilter, relationshipFilter, showFollowUpsOnly, showFavoritesOnly]);

  const handleSaveContact = async () => {
    try {
      if (!editingContact.name?.trim()) return toast.error('Name is required');
      if (!editingContact.category) return toast.error('Category is required');
      if (!editingContact.email?.trim() && !editingContact.phone?.trim()) return toast.error('Email or phone is required');
      if (isEditing && editingContact._id) {
        await contactsApi.update(editingContact._id, editingContact);
        toast.success('Contact updated');
      } else {
        await contactsApi.create(editingContact);
        toast.success('Contact created');
      }
      setShowFormModal(false);
      setEditingContact({});
      setIsEditing(false);
      fetchContacts();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await contactsApi.delete(id);
      toast.success('Contact deleted');
      setShowDetailModal(false);
      fetchContacts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await contactsApi.toggleFavorite(id);
      fetchContacts();
      fetchStats();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleAddInteraction = async () => {
    if (!selectedContact) return;
    if (!interactionForm.subject.trim()) return toast.error('Interaction subject is required');
    if (interactionForm.followUpRequired && !interactionForm.followUpDate) return toast.error('Choose a follow-up date');
    try {
      await contactsApi.addInteraction(selectedContact._id, interactionForm);
      toast.success('Interaction added');
      setShowInteractionForm(false);
      setInteractionForm({ type: 'call', subject: '', notes: '', outcome: 'neutral', date: '', whatWasSent: '', response: '', followUpRequired: false, followUpDate: '' });
      const res = await contactsApi.getById(selectedContact._id);
      setSelectedContact(res.data.data);
      fetchContacts();
    } catch (err) {
      toast.error('Failed to add interaction');
    }
  };

  const handleAddReminder = async () => {
    if (!selectedContact) return;
    if (!reminderForm.title.trim()) return toast.error('Title is required');
    if (!reminderForm.date) return toast.error('Date is required');
    try {
      await contactsApi.addReminder(selectedContact._id, reminderForm);
      toast.success('Reminder added');
      setShowReminderForm(false);
      setReminderForm({ title: '', date: '', type: 'follow_up', notes: '' });
      const res = await contactsApi.getById(selectedContact._id);
      setSelectedContact(res.data.data);
      fetchStats();
    } catch (err) {
      toast.error('Failed to add reminder');
    }
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!selectedContact) return;
    if (!window.confirm('Delete this interaction? This cannot be undone.')) return;
    try {
      await contactsApi.deleteInteraction(selectedContact._id, interactionId);
      const res = await contactsApi.getById(selectedContact._id);
      setSelectedContact(res.data.data);
      fetchContacts();
      fetchStats();
      toast.success('Interaction deleted');
    } catch { toast.error('Failed to delete interaction'); }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    if (!selectedContact) return;
    try {
      await contactsApi.completeReminder(selectedContact._id, reminderId);
      toast.success('Reminder completed');
      const res = await contactsApi.getById(selectedContact._id);
      setSelectedContact(res.data.data);
      fetchStats();
    } catch (err) {
      toast.error('Failed to complete reminder');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!selectedContact) return;
    if (!window.confirm('Delete this reminder? This cannot be undone.')) return;
    try {
      await contactsApi.deleteReminder(selectedContact._id, reminderId);
      toast.success('Reminder deleted');
      const res = await contactsApi.getById(selectedContact._id);
      setSelectedContact(res.data.data);
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete reminder');
    }
  };

  const openDetail = async (contact: ContactData) => {
    try {
      const res = await contactsApi.getById(contact._id);
      setSelectedContact(res.data.data);
      setShowDetailModal(true);
      setActiveTab('overview');
    } catch (err) {
      toast.error('Failed to load contact');
    }
  };

  const openEdit = (contact: ContactData) => {
    setEditingContact({ ...contact });
    setIsEditing(true);
    setShowFormModal(true);
    setShowDetailModal(false);
  };

  const openCreate = () => {
    setEditingContact({ ...emptyContact });
    setIsEditing(false);
    setShowFormModal(true);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const addressStr = (addr: any) => {
    if (!addr) return '';
    return [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Contacts', value: stats?.total ?? '—', icon: <User size={16} className="text-indigo-500" /> },
          { label: 'Favorites', value: stats?.favorites ?? '—', icon: <Star size={16} className="text-amber-400" /> },
          { label: 'Categories', value: stats?.byCategory ? Object.keys(stats.byCategory).length : '—', icon: <Building size={16} className="text-emerald-500" /> },
          { label: 'Upcoming Reminders', value: stats?.upcomingRemindersCount ?? '—', icon: <Clock size={16} className="text-rose-500" /> },
          { label: 'Overdue Follow-ups', value: stats?.overdueFollowUps ?? '—', icon: <AlertCircle size={16} className="text-red-500" /> },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-4">
            <div className="flex items-center gap-2 mb-1">{s.icon}<div className="text-xl font-bold text-gray-900">{s.value}</div></div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48 bg-white border border-gray-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
          <Search size={14} className="text-gray-400" />
          <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none flex-1" />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10">
          <option value="">All Categories</option>
          {Object.entries(categoryLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <select value={relationshipFilter} onChange={e => { setRelationshipFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 outline-none">
          <option value="">All Relationships</option>{['new','contacted','warm','strong','inactive','archived'].map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <button onClick={() => { setShowFollowUpsOnly(!showFollowUpsOnly); setPage(1); }} className={`px-3 py-2 rounded-lg text-sm font-medium border ${showFollowUpsOnly ? 'bg-red-50 text-red-700 border-red-300' : 'bg-white text-gray-600 border-gray-300'}`}><Clock size={14} className="mr-1.5 inline" />Due follow-ups</button>
        <button onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setPage(1); }} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border ${showFavoritesOnly ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
          <Star size={14} className={showFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''} /> Favorites
        </button>
        <button onClick={openCreate} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2">
          <Plus size={14} />Add Contact
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden xl:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden xl:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden 2xl:table-cell">Last Contacted</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-10"></th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading contacts...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No contacts found</td></tr>
              ) : contacts.map(c => {
                const cc = categoryColors[c.category] || categoryColors.other;
                return (
                  <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: getAvatarColor(c.name) }}>{getInitials(c.name)}</div>
                        <div>
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500 md:hidden">{c.company || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.company || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{c.role || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cc.bg} ${cc.text} ${cc.border}`}>
                        {categoryLabels[c.category] || c.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden 2xl:table-cell">{formatDate(c.lastContactedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={e => handleToggleFavorite(e, c._id)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                        <Star size={14} className={c.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Edit"><Edit3 size={14} /></button>
                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(c._id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">Page {page} of {pagination.pages} ({pagination.total} contacts)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: getAvatarColor(selectedContact.name) }}>{getInitials(selectedContact.name)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedContact.name}</h2>
                    <button onClick={async () => { await contactsApi.toggleFavorite(selectedContact._id); const res = await contactsApi.getById(selectedContact._id); setSelectedContact(res.data.data); fetchContacts(); fetchStats(); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                      <Star size={16} className={selectedContact.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                    </button>
                  </div>
                   <div className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{selectedContact.role || 'No role'} {selectedContact.company ? `at ${selectedContact.company}` : ''}</div>
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryColors[selectedContact.category]?.bg || 'bg-gray-50'} ${categoryColors[selectedContact.category]?.text || 'text-gray-700'} ${categoryColors[selectedContact.category]?.border || 'border-gray-200'}`}>
                      {categoryLabels[selectedContact.category] || selectedContact.category}
                    </span>
                  </div>
                </div>
              </div>
               <button onClick={() => setShowDetailModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 dark:border-gray-700">
              {(['overview', 'interactions', 'reminders'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-all capitalize ${activeTab === tab ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>{tab}</button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedContact.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Mail size={14} className="text-gray-400" />{selectedContact.email}</div>
                    )}
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Phone size={14} className="text-gray-400" />{selectedContact.phone}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div><p className="text-[10px] uppercase text-gray-400">Relationship</p><p className="mt-1 text-sm font-semibold capitalize text-gray-800">{selectedContact.relationshipStatus || 'new'}</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Strength</p><p className="mt-1 text-sm font-semibold text-gray-800">{selectedContact.relationshipStrength || 0}/10</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Last Contact</p><p className="mt-1 text-xs font-medium text-gray-700">{formatDate(selectedContact.lastContactedAt)}</p></div>
                    <div><p className="text-[10px] uppercase text-gray-400">Follow Up</p><p className={`mt-1 text-xs font-medium ${selectedContact.followUpDate && new Date(selectedContact.followUpDate) <= new Date() ? 'text-red-600' : 'text-gray-700'}`}>{formatDate(selectedContact.followUpDate)}</p></div>
                  </div>
                  {(selectedContact.genrePreference || selectedContact.whatWasSent || selectedContact.response) && <div className="grid gap-3 sm:grid-cols-3">{selectedContact.genrePreference && <div><p className="text-[10px] uppercase text-gray-400">Genre Preference</p><p className="mt-1 text-sm text-gray-700">{selectedContact.genrePreference}</p></div>}{selectedContact.whatWasSent && <div><p className="text-[10px] uppercase text-gray-400">What Was Sent</p><p className="mt-1 text-sm text-gray-700">{selectedContact.whatWasSent}</p></div>}{selectedContact.response && <div><p className="text-[10px] uppercase text-gray-400">Response</p><p className="mt-1 text-sm text-gray-700">{selectedContact.response}</p></div>}</div>}
                  {addressStr(selectedContact.address) && (
                    <div className="flex items-start gap-2 text-sm text-gray-600"><MapPin size={14} className="text-gray-400 mt-0.5" />{addressStr(selectedContact.address)}</div>
                  )}
                  {selectedContact.relatedArtists?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Related Artists</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedContact.relatedArtists.map((a: any) => (
                          <span key={a._id} className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium">{a.artistName || a.name || a.stageName}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedContact.tags?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedContact.tags.map((t, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium"><Tag size={10} />{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedContact.notes && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</div>
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedContact.notes}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Source: </span><span className="text-gray-700">{sourceLabels[selectedContact.source] || selectedContact.source}</span></div>
                    <div><span className="text-gray-500">Added: </span><span className="text-gray-700">{formatDate(selectedContact.createdAt)}</span></div>
                    {selectedContact.assignedTo && (
                      <div><span className="text-gray-500">Assigned to: </span><span className="text-gray-700">{selectedContact.assignedTo.name}</span></div>
                    )}
                    {selectedContact.socialLinks && Object.values(selectedContact.socialLinks).some(v => v) && (
                      <div className="flex items-center gap-3">
                        {selectedContact.socialLinks.instagram && <a href={selectedContact.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} />Instagram</a>}
                        {selectedContact.socialLinks.linkedin && <a href={selectedContact.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} />LinkedIn</a>}
                        {selectedContact.socialLinks.twitter && <a href={selectedContact.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 text-xs"><ExternalLink size={10} />Twitter</a>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'interactions' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => setShowInteractionForm(!showInteractionForm)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"><Plus size={12} />Add Interaction</button>
                  </div>
                  {showInteractionForm && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 dark:bg-gray-800/40 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Type</label>
                          <select value={interactionForm.type} onChange={e => setInteractionForm({ ...interactionForm, type: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                            <option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="message">Message</option><option value="event">Event</option><option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Outcome</label>
                          <select value={interactionForm.outcome} onChange={e => setInteractionForm({ ...interactionForm, outcome: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                            <option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option><option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Subject</label>
                        <input value={interactionForm.subject} onChange={e => setInteractionForm({ ...interactionForm, subject: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Subject" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Interaction Date</label><input type="datetime-local" value={interactionForm.date} onChange={e => setInteractionForm({ ...interactionForm, date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                        <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">What Was Sent</label><input value={interactionForm.whatWasSent} onChange={e => setInteractionForm({ ...interactionForm, whatWasSent: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Music, deck, proposal..." /></div>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Response</label><textarea value={interactionForm.response} onChange={e => setInteractionForm({ ...interactionForm, response: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Response received or current status" /></div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Notes</label>
                        <textarea value={interactionForm.notes} onChange={e => setInteractionForm({ ...interactionForm, notes: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 resize-none" placeholder="Notes" />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-600"><input type="checkbox" checked={interactionForm.followUpRequired} onChange={e => setInteractionForm({ ...interactionForm, followUpRequired: e.target.checked })} className="h-4 w-4 rounded" />Follow-up required</label>
                      {interactionForm.followUpRequired && <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Follow-up Date</label><input type="datetime-local" value={interactionForm.followUpDate} onChange={e => setInteractionForm({ ...interactionForm, followUpDate: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowInteractionForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-all dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                        <button onClick={handleAddInteraction} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all">Save</button>
                      </div>
                    </div>
                  )}
                  {selectedContact.interactions?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No interactions yet</div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                      <div className="space-y-4">
                        {[...selectedContact.interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inter => (
                          <div key={inter._id} className="relative pl-10">
                            <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{interactionTypeIcons[inter.type] || '📝'}</span>
                                  <span className="text-sm font-semibold text-gray-900 capitalize">{inter.type}</span>
                                  {inter.subject && <span className="text-sm text-gray-600">— {inter.subject}</span>}
                                </div>
                                <div className="flex items-center gap-1"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${outcomeColors[inter.outcome]}`}>{inter.outcome}</span><button onClick={() => handleDeleteInteraction(inter._id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Delete interaction"><Trash2 size={11} /></button></div>
                              </div>
                              <div className="text-xs text-gray-500 mb-1">{formatDateTime(inter.date)}</div>
                              {inter.notes && <div className="text-sm text-gray-600 mt-1">{inter.notes}</div>}
                              {inter.whatWasSent && <div className="mt-2 text-xs text-gray-500"><span className="font-semibold">Sent:</span> {inter.whatWasSent}</div>}
                              {inter.response && <div className="mt-1 text-xs text-gray-500"><span className="font-semibold">Response:</span> {inter.response}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reminders' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => setShowReminderForm(!showReminderForm)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"><Plus size={12} />Add Reminder</button>
                  </div>
                  {showReminderForm && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 dark:bg-gray-800/40 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Title</label>
                          <input value={reminderForm.title} onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Title" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Date</label>
                          <input type="datetime-local" value={reminderForm.date} onChange={e => setReminderForm({ ...reminderForm, date: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Type</label>
                        <select value={reminderForm.type} onChange={e => setReminderForm({ ...reminderForm, type: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                          <option value="follow_up">Follow Up</option><option value="birthday">Birthday</option><option value="contract_renewal">Contract Renewal</option><option value="meeting">Meeting</option><option value="payment">Payment</option><option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Notes</label>
                        <textarea value={reminderForm.notes} onChange={e => setReminderForm({ ...reminderForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 resize-none" placeholder="Notes" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowReminderForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-all">Cancel</button>
                        <button onClick={handleAddReminder} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all">Save</button>
                      </div>
                    </div>
                  )}
                  {selectedContact.reminders?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No reminders yet</div>
                  ) : (
                    <div className="space-y-2">
                      {[...selectedContact.reminders].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(rem => (
                        <div key={rem._id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${rem.completed ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                          <button onClick={() => !rem.completed && handleCompleteReminder(rem._id)} className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${rem.completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-indigo-500'}`}>
                            {rem.completed && <Check size={12} className="text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${rem.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{rem.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${reminderTypeColors[rem.type]}`}>{rem.type.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-gray-500">{formatDate(rem.date)}</span>
                            </div>
                            {rem.notes && <div className="text-xs text-gray-500 mt-1">{rem.notes}</div>}
                          </div>
                          {!rem.completed && (
                            <button onClick={() => handleDeleteReminder(rem._id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"><Trash2 size={12} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <button onClick={() => setDeleteTarget(selectedContact._id)} className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-1 dark:text-red-400"><Trash2 size={12} />Delete Contact</button>
              <button onClick={() => openEdit(selectedContact)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"><Edit3 size={14} />Edit Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowFormModal(false); setIsEditing(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isEditing ? 'Edit Contact' : 'New Contact'}</h2>
              <button onClick={() => { setShowFormModal(false); setIsEditing(false); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Basic Info */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Basic Info</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Name *</label>
                    <input value={editingContact.name || ''} onChange={e => setEditingContact({ ...editingContact, name: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Role</label>
                    <input value={editingContact.role || ''} onChange={e => setEditingContact({ ...editingContact, role: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Job title" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Email</label>
                    <input type="email" value={editingContact.email || ''} onChange={e => setEditingContact({ ...editingContact, email: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Phone</label>
                    <input value={editingContact.phone || ''} onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Company</label>
                    <input value={editingContact.company || ''} onChange={e => setEditingContact({ ...editingContact, company: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Company name" />
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Category</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Category *</label>
                    <select value={editingContact.category || 'other'} onChange={e => setEditingContact({ ...editingContact, category: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                      {Object.entries(categoryLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Source</label>
                    <select value={editingContact.source || 'other'} onChange={e => setEditingContact({ ...editingContact, source: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                      {Object.entries(sourceLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Relationship</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Relationship Status</label><select value={editingContact.relationshipStatus || 'new'} onChange={e => setEditingContact({ ...editingContact, relationshipStatus: e.target.value as ContactData['relationshipStatus'] })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">{['new','contacted','warm','strong','inactive','archived'].map(status => <option key={status} value={status}>{status}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Relationship Strength ({editingContact.relationshipStrength || 0}/10)</label><input type="range" min="0" max="10" value={editingContact.relationshipStrength || 0} onChange={e => setEditingContact({ ...editingContact, relationshipStrength: Number(e.target.value) })} className="w-full mt-2" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Genre Preference</label><input value={editingContact.genrePreference || ''} onChange={e => setEditingContact({ ...editingContact, genrePreference: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Hip-Hop, R&B, Pop..." /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Follow-up Date</label><input type="datetime-local" value={editingContact.followUpDate?.slice(0, 16) || ''} onChange={e => setEditingContact({ ...editingContact, followUpDate: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">What Was Sent</label><textarea value={editingContact.whatWasSent || ''} onChange={e => setEditingContact({ ...editingContact, whatWasSent: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Track, press kit, proposal..." /></div>
                  <div><label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Response</label><textarea value={editingContact.response || ''} onChange={e => setEditingContact({ ...editingContact, response: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="Their response or current outcome" /></div>
                </div>
              </div>

              {/* Address */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Address</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Street</label>
                    <input value={editingContact.address?.street || ''} onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, street: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">City</label>
                    <input value={editingContact.address?.city || ''} onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, city: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">State</label>
                    <input value={editingContact.address?.state || ''} onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, state: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Zip Code</label>
                    <input value={editingContact.address?.zipCode || ''} onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, zipCode: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Country</label>
                    <input value={editingContact.address?.country || ''} onChange={e => setEditingContact({ ...editingContact, address: { ...editingContact.address!, country: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Social Links</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Instagram</label>
                    <input value={editingContact.socialLinks?.instagram || ''} onChange={e => setEditingContact({ ...editingContact, socialLinks: { ...editingContact.socialLinks!, instagram: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">LinkedIn</label>
                    <input value={editingContact.socialLinks?.linkedin || ''} onChange={e => setEditingContact({ ...editingContact, socialLinks: { ...editingContact.socialLinks!, linkedin: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Twitter</label>
                    <input value={editingContact.socialLinks?.twitter || ''} onChange={e => setEditingContact({ ...editingContact, socialLinks: { ...editingContact.socialLinks!, twitter: e.target.value } })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
                  </div>
                </div>
              </div>

              {/* Tags & Notes */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Tags & Notes</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Tags (comma separated)</label>
                    <input
                      value={editingContact.tags?.join(', ') || ''}
                      onChange={e => setEditingContact({ ...editingContact, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      placeholder="e.g. VIP, priority, local"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1 dark:text-gray-300">Notes</label>
                    <textarea value={editingContact.notes || ''} onChange={e => setEditingContact({ ...editingContact, notes: e.target.value })} rows={3} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 resize-none" placeholder="Any notes about this contact..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <button onClick={() => { setShowFormModal(false); setIsEditing(false); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-all dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleSaveContact} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md">{isEditing ? 'Update Contact' : 'Create Contact'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) handleDeleteContact(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Contacts;
