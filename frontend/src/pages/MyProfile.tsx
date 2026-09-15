import React, { useEffect, useState, useRef } from 'react';
import { Camera, Save, Loader2, AlertCircle, User, Mail, Phone, MapPin, Music2, Link2, Wallet, Building2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { getAvatarColor, getInitials } from '../utils/helpers';
import type { Artist } from '../types';

const EMPTY_SOCIAL = { instagram: '', tiktok: '', youtube: '', spotify: '', twitter: '' };
const EMPTY_ADDRESS = { street: '', city: '', state: '', zipCode: '', country: '' };
const EMPTY_PAYMENT = { method: '', bankName: '', accountNumber: '', routingNumber: '', paypalEmail: '' };

const inputCls = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5 dark:text-gray-400';

const MyProfile: React.FC = () => {
  const [profile, setProfile] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'coverPhoto' | null>(null);
  const [editing, setEditing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    artistName: '', legalName: '', phone: '', email: '', dateOfBirth: '',
    bio: '', genre: '', previousReleases: '', catalogOwnership: '', proAffiliation: '',
    socialLinks: { ...EMPTY_SOCIAL },
    address: { ...EMPTY_ADDRESS },
    paymentInfo: { ...EMPTY_PAYMENT },
    publisher: { name: '', contact: '' },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getMyProfile();
      setProfile(res.data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to load profile');
    }
    setLoading(false);
  };

  const startEditing = () => {
    if (!profile) return;
    setForm({
      artistName: profile.artistName || profile.stageName || profile.name || '',
      legalName: profile.legalName || profile.name || '',
      phone: profile.phone || '',
      email: profile.email || '',
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
      bio: profile.bio || '',
      genre: profile.genre || '',
      previousReleases: profile.previousReleases || '',
      catalogOwnership: profile.catalogOwnership || '',
      proAffiliation: profile.proAffiliation || '',
      socialLinks: { ...EMPTY_SOCIAL, ...profile.socialLinks },
      address: { ...EMPTY_ADDRESS, ...profile.address },
      paymentInfo: { ...EMPTY_PAYMENT, ...profile.paymentInfo },
      publisher: { name: profile.publisher?.name || '', contact: profile.publisher?.contact || '' },
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await dashboardApi.updateMyProfile(form);
      setProfile(res.data.data);
      setEditing(false);
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save profile');
    }
    setSaving(false);
  };

  const handleImageUpload = async (file: File, field: 'image' | 'coverPhoto') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field', field);
    setUploading(field);
    try {
      const res = await dashboardApi.uploadMyImage(formData);
      setProfile(res.data.data);
      toast.success(field === 'image' ? 'Profile photo updated' : 'Cover photo updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Upload failed');
    }
    setUploading(null);
  };

  const handleRemoveImage = async (field: 'image' | 'coverPhoto') => {
    if (!profile || !window.confirm(`Remove this ${field === 'image' ? 'profile' : 'cover'} photo?`)) return;
    setUploading(field);
    try {
      const res = await dashboardApi.removeMyImage(field);
      setProfile(res.data.data);
      toast.success(`${field === 'image' ? 'Profile' : 'Cover'} photo removed`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove image');
    }
    setUploading(null);
  };

  const setSocial = (key: keyof typeof EMPTY_SOCIAL, value: string) =>
    setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: value } }));
  const setAddr = (key: keyof typeof EMPTY_ADDRESS, value: string) =>
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  const setPay = (key: keyof typeof EMPTY_PAYMENT, value: string) =>
    setForm((f) => ({ ...f, paymentInfo: { ...f.paymentInfo, [key]: value } }));

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={28} text="Loading your profile..." /></div>;
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="text-[#F59E0B] mx-auto" />
          <p className="text-sm font-semibold text-[var(--hbe-text-soft)]">No artist profile linked to your account yet.</p>
          <p className="text-xs text-[var(--hbe-muted)]">Contact your manager to set up your artist profile.</p>
        </div>
      </div>
    );
  }

  const displayName = profile.artistName || profile.stageName || profile.name || 'Artist';
  const initials = getInitials(displayName);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="relative h-40 md:h-52">
          {profile.coverPhoto ? (
            <img src={profile.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${getAvatarColor(displayName)}40 0%, ${getAvatarColor(displayName)}15 100%)` }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)' }} />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'coverPhoto'); }}
          />
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={uploading === 'coverPhoto'}
            className="absolute top-3 right-3 p-2 rounded-lg bg-white/90 text-gray-500 hover:text-gray-700 shadow-sm transition-colors"
            title="Change cover photo"
          >
            {uploading === 'coverPhoto' ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          </button>
          {editing && profile.coverPhoto && (
            <button onClick={() => handleRemoveImage('coverPhoto')} disabled={uploading === 'coverPhoto'} className="absolute top-3 right-12 p-2 rounded-lg bg-white/90 text-red-500 hover:text-red-700 shadow-sm transition-colors" title="Remove cover photo">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="px-6 pb-6 -mt-12 relative">
          <div className="relative w-28 h-28 rounded-2xl border-4 border-white shadow-lg overflow-hidden dark:border-gray-800">
            {uploading === 'image' ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700"><Loader2 size={22} className="animate-spin text-gray-500 dark:text-gray-400" /></div>
            ) : profile.image ? (
              <img src={profile.image} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold" style={{ background: `linear-gradient(135deg, ${getAvatarColor(displayName)}, ${getAvatarColor(displayName)}99)` }}>
                {initials}
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'image'); }}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading === 'image'}
              className="absolute bottom-1 right-1 p-1.5 rounded-full bg-white text-gray-500 hover:text-gray-700 shadow border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200 dark:border-gray-600"
              title="Change profile photo"
            >
              <Camera size={13} />
            </button>
            {editing && profile.image && (
            <button onClick={() => handleRemoveImage('image')} disabled={uploading === 'image'} className="absolute bottom-1 right-9 p-1.5 rounded-full bg-white text-red-500 hover:text-red-700 shadow border border-gray-200 dark:bg-gray-800 dark:border-gray-600" title="Remove profile photo">
                <Trash2 size={13} />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {profile.genre && <span className="flex items-center gap-1"><Music2 size={12} />{profile.genre}</span>}
                {profile.email && <span className="flex items-center gap-1"><Mail size={12} />{profile.email}</span>}
                {profile.phone && <span className="flex items-center gap-1"><Phone size={12} />{profile.phone}</span>}
                {profile.address?.city && <span className="flex items-center gap-1"><MapPin size={12} />{profile.address.city}</span>}
              </div>
            </div>
            {!editing && (
              <button onClick={startEditing} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 dark:bg-gray-800 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 dark:text-gray-100"><User size={16} /> Edit Profile</h2>

          {/* Personal */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Artist Name</label>
              <input className={inputCls} value={form.artistName} onChange={(e) => setForm({ ...form, artistName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Legal Name</label>
              <input className={inputCls} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Genre</label>
              <input className={inputCls} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>PRO Affiliation</label>
              <input className={inputCls} value={form.proAffiliation} onChange={(e) => setForm({ ...form, proAffiliation: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Bio</label>
            <textarea className={`${inputCls} h-24 resize-none`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><MapPin size={15} /> Address</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className={labelCls}>Street</label><input className={inputCls} value={form.address.street} onChange={(e) => setAddr('street', e.target.value)} /></div>
              <div><label className={labelCls}>City</label><input className={inputCls} value={form.address.city} onChange={(e) => setAddr('city', e.target.value)} /></div>
              <div><label className={labelCls}>State</label><input className={inputCls} value={form.address.state} onChange={(e) => setAddr('state', e.target.value)} /></div>
              <div><label className={labelCls}>Zip Code</label><input className={inputCls} value={form.address.zipCode} onChange={(e) => setAddr('zipCode', e.target.value)} /></div>
              <div><label className={labelCls}>Country</label><input className={inputCls} value={form.address.country} onChange={(e) => setAddr('country', e.target.value)} /></div>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><Link2 size={15} /> Social Links</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {(Object.keys(EMPTY_SOCIAL) as Array<keyof typeof EMPTY_SOCIAL>).map((key) => (
                <div key={key}>
                  <label className={labelCls} style={{ textTransform: 'capitalize' }}>{key}</label>
                  <input className={inputCls} value={form.socialLinks[key]} onChange={(e) => setSocial(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Music Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><Music2 size={15} /> Music Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Previous Releases</label><input className={inputCls} value={form.previousReleases} onChange={(e) => setForm({ ...form, previousReleases: e.target.value })} /></div>
              <div><label className={labelCls}>Catalog Ownership</label><input className={inputCls} value={form.catalogOwnership} onChange={(e) => setForm({ ...form, catalogOwnership: e.target.value })} /></div>
              <div><label className={labelCls}>Publisher Name</label><input className={inputCls} value={form.publisher.name} onChange={(e) => setForm({ ...form, publisher: { ...form.publisher, name: e.target.value } })} /></div>
              <div><label className={labelCls}>Publisher Contact</label><input className={inputCls} value={form.publisher.contact} onChange={(e) => setForm({ ...form, publisher: { ...form.publisher, contact: e.target.value } })} /></div>
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><Wallet size={15} /> Payment Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Payment Method</label><input className={inputCls} value={form.paymentInfo.method} onChange={(e) => setPay('method', e.target.value)} /></div>
              <div><label className={labelCls}>Bank Name</label><input className={inputCls} value={form.paymentInfo.bankName} onChange={(e) => setPay('bankName', e.target.value)} /></div>
              <div><label className={labelCls}>Account Number</label><input className={inputCls} value={form.paymentInfo.accountNumber} onChange={(e) => setPay('accountNumber', e.target.value)} /></div>
              <div><label className={labelCls}>Routing Number</label><input className={inputCls} value={form.paymentInfo.routingNumber} onChange={(e) => setPay('routingNumber', e.target.value)} /></div>
              <div><label className={labelCls}>PayPal Email</label><input className={inputCls} value={form.paymentInfo.paypalEmail} onChange={(e) => setPay('paypalEmail', e.target.value)} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* About */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><Building2 size={15} /> About</h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap dark:text-gray-300">{profile.bio || 'No bio yet.'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-gray-400 dark:text-gray-500">Legal Name</dt><dd className="font-medium text-gray-800 dark:text-gray-100">{profile.legalName || profile.name || '—'}</dd></div>
              <div><dt className="text-xs text-gray-400 dark:text-gray-500">Genre</dt><dd className="font-medium text-gray-800 dark:text-gray-100">{profile.genre || '—'}</dd></div>
              <div><dt className="text-xs text-gray-400 dark:text-gray-500">PRO</dt><dd className="font-medium text-gray-800 dark:text-gray-100">{profile.proAffiliation || '—'}</dd></div>
              <div><dt className="text-xs text-gray-400 dark:text-gray-500">Royalty Rate</dt><dd className="font-medium text-gray-800 dark:text-gray-100">{profile.royaltyRate ? `${profile.royaltyRate}%` : '—'}</dd></div>
            </dl>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 dark:text-gray-200"><Mail size={15} /> Contact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3"><Mail size={15} className="text-gray-400 dark:text-gray-500" /><span className="text-gray-700 dark:text-gray-200">{profile.email || '—'}</span></div>
              <div className="flex items-center gap-3"><Phone size={15} className="text-gray-400 dark:text-gray-500" /><span className="text-gray-700 dark:text-gray-200">{profile.phone || '—'}</span></div>
              {profile.address && (profile.address.street || profile.address.city) && (
                <div className="flex items-center gap-3"><MapPin size={15} className="text-gray-400 dark:text-gray-500" /><span className="text-gray-700 dark:text-gray-200">{profile.address.city}, {profile.address.state}, {profile.address.country}</span></div>
              )}
              <div className="pt-3">
                <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1 dark:text-gray-500"><Building2 size={12} />Publisher</div>
                <div className="text-gray-700 dark:text-gray-200">{profile.publisher?.name || '—'}{profile.publisher?.contact ? ` (${profile.publisher.contact})` : ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
