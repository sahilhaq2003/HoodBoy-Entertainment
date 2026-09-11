import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Music, DollarSign, TrendingUp, MapPin, Phone,
  Mail, Globe, AtSign, Video, MessageCircle, Music2, FileText, CheckCircle,
  XCircle, Clock, Send, Trash2, ExternalLink, User, Calendar,
  Star, Camera, Shield, CreditCard, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi } from '../services/api';
import OnboardingProgress from '../components/onboarding/OnboardingProgress';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrency, formatNumber, formatDate, getAvatarColor, getInitials } from '../utils/helpers';
import type { Artist } from '../types';

const ArtistProfile: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [createdLogin, setCreatedLogin] = useState<{ _id: string; name: string; email: string; tempPassword: string } | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) loadArtist(id);
  }, [id]);

  const loadArtist = async (artistId: string) => {
    setLoading(true);
    try {
      const res = await artistsApi.getById(artistId);
      setArtist(res.data.data);
    } catch (e) {
      toast.error('Failed to load artist');
      navigate('/artists');
    }
    setLoading(false);
  };

  const handleApprove = async () => {
    if (!artist) return;
    setActionLoading(true);
    try {
      const res = await artistsApi.approve(artist._id, approveNotes);
      setArtist(res.data.data);
      setApproveNotes('');
      setCreatedLogin(res.data.autoCreatedUser || null);
      if (res.data.autoCreatedUser) {
        toast.success('Artist approved! Login account created.');
      } else {
        toast.success('Artist onboarding approved!');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to approve');
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!artist) return;
    setActionLoading(true);
    try {
      const res = await artistsApi.reject(artist._id, rejectNotes);
      setArtist(res.data.data);
      setShowRejectModal(false);
      setRejectNotes('');
      toast.success('Artist onboarding rejected');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!artist) return;
    try {
      await artistsApi.delete(artist._id);
      toast.success('Artist deleted');
      navigate('/artists');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete');
    }
  };

  const handleImageUpload = async (file: File, field: 'image' | 'coverPhoto') => {
    if (!artist) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field', field);
    setUploadingImage(field);
    try {
      const res = await artistsApi.uploadImage(artist._id, formData);
      setArtist(res.data.data);
      toast.success(field === 'image' ? 'Profile photo updated' : 'Cover photo updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Upload failed');
    }
    setUploadingImage(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size={28} text="Loading artist profile..." />
      </div>
    );
  }

  if (!artist) return null;

  const displayName = artist.artistName || artist.stageName || artist.name;
  const legalDisplay = artist.legalName || artist.name;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Cover Photo & Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        {/* Cover Photo */}
        <div className="relative h-40 md:h-52">
          {artist.coverPhoto ? (
            <img
              src={artist.coverPhoto}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${getAvatarColor(displayName)}30 0%, ${getAvatarColor(displayName)}10 100%)`,
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
            }}
          />

          {/* Cover photo upload button */}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, 'coverPhoto');
            }}
            className="hidden"
          />
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingImage === 'coverPhoto'}
            className="absolute top-3 right-3 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-colors shadow-sm dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/80"
            title="Change cover photo"
          >
            <Camera size={16} />
          </button>

          {/* Back button */}
          <button
            onClick={() => navigate('/artists')}
            className="absolute top-3 left-3 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-colors shadow-sm dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/80"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        {/* Artist Info Bar */}
        <div className="px-6 pb-5 -mt-12 relative">
          <div className="flex items-end gap-4">
            {/* Profile Photo */}
            <div className="relative">
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, 'image');
                }}
                className="hidden"
              />
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 cursor-pointer relative overflow-hidden shadow-lg"
                style={{
                  background: getAvatarColor(displayName),
                  border: '4px solid #FFFFFF',
                }}
                onClick={() => profileInputRef.current?.click()}
              >
                {artist.image ? (
                  <img src={artist.image} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  getInitials(displayName)
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              {uploadingImage === 'image' && (
                <div className="absolute inset-0 rounded-2xl bg-white/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Name & Status */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
                <StatusBadge status={artist.status} />
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                  artist.onboardingStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800' :
                  artist.onboardingStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800' :
                  artist.onboardingStatus === 'pending_approval' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800' :
                  artist.onboardingStatus === 'in_progress' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-800' :
                  'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}>
                  {artist.onboardingStatus?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              </div>
              {legalDisplay !== displayName && (
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Legal: {legalDisplay}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={() => navigate(`/artists/onboarding/${artist._id}`)}
                className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              >
                <Edit size={14} /> Edit
              </button>
              <button onClick={() => setDeleteConfirmOpen(true)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 text-red-500 hover:text-red-600 hover:border-red-300 dark:bg-gray-800 dark:text-red-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-red-300 dark:hover:border-red-600">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Progress */}
      {(artist.onboardingStatus === 'in_progress' || artist.onboardingStatus === 'not_started') && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 dark:bg-gray-800 dark:border-gray-700">
          <OnboardingProgress currentStep={artist.onboardingStep} onboardingStatus={artist.onboardingStatus} />
        </div>
      )}

      {/* Admin Actions (for pending approval) */}
      {artist.onboardingStatus === 'pending_approval' && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 dark:bg-gray-800 dark:border-amber-800">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={18} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Pending Approval</h3>
          </div>

          {/* Approval notes */}
          <div className="mb-4">
            <label className="block text-sm text-gray-500 mb-1.5 dark:text-gray-400">Approval Notes (optional)</label>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full h-16 resize-none text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder="Add notes for this approval..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle size={14} /> Approve
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 text-red-500 hover:text-red-600 hover:border-red-300 dark:bg-gray-800 dark:text-red-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-red-300 dark:hover:border-red-600"
            >
              <XCircle size={14} /> Reject
            </button>
            <button
              onClick={() => navigate(`/artists/onboarding/${artist._id}`)}
              className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100"
            >
              <Send size={14} /> Review Details
            </button>
          </div>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {artist.bio && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400">Biography</h3>
              <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-200">{artist.bio}</p>
            </div>
          )}

          {/* Social Links */}
          {artist.socialLinks && Object.values(artist.socialLinks).some(Boolean) && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400">Social Media</h3>
              <div className="flex flex-wrap gap-2">
                {artist.socialLinks.instagram && (
                  <a href={artist.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-pink-600 bg-pink-50 border border-pink-200 hover:bg-pink-100 transition-colors dark:text-pink-400 dark:bg-pink-500/10 dark:border-pink-800 dark:hover:bg-pink-500/20"
                  >
                    <AtSign size={12} /> Instagram <ExternalLink size={10} />
                  </a>
                )}
                {artist.socialLinks.tiktok && (
                  <a href={artist.socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-600 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-800 dark:hover:bg-cyan-500/20"
                  >
                    <Globe size={12} /> TikTok <ExternalLink size={10} />
                  </a>
                )}
                {artist.socialLinks.youtube && (
                  <a href={artist.socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors dark:text-red-400 dark:bg-red-500/10 dark:border-red-800 dark:hover:bg-red-500/20"
                  >
                    <Video size={12} /> YouTube <ExternalLink size={10} />
                  </a>
                )}
                {artist.socialLinks.spotify && (
                  <a href={artist.socialLinks.spotify} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors dark:text-green-400 dark:bg-green-500/10 dark:border-green-800 dark:hover:bg-green-500/20"
                  >
                    <Music2 size={12} /> Spotify <ExternalLink size={10} />
                  </a>
                )}
                {artist.socialLinks.twitter && (
                  <a href={artist.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-800 dark:hover:bg-blue-500/20"
                  >
                    <MessageCircle size={12} /> Twitter <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Music Info */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400 flex items-center gap-2">
              <Music size={14} /> Music Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-xs">
                <span className="text-gray-500 block mb-1 dark:text-gray-400">Genre</span>
                <span className="text-gray-700 font-medium dark:text-gray-200">{artist.genre || '-'}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-500 block mb-1 dark:text-gray-400">PRO Affiliation</span>
                <span className="text-gray-700 font-medium dark:text-gray-200">{artist.proAffiliation || '-'}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-500 block mb-1 dark:text-gray-400">Publisher</span>
                <span className="text-gray-700 font-medium dark:text-gray-200">{artist.publisher?.name || '-'}</span>
              </div>
              <div className="text-xs">
                <span className="text-gray-500 block mb-1 dark:text-gray-400">Catalog Ownership</span>
                <span className="text-gray-700 font-medium dark:text-gray-200">{artist.catalogOwnership || '-'}</span>
              </div>
            </div>
            {artist.previousReleases && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 block mb-1 dark:text-gray-400">Previous Releases</span>
                <p className="text-xs text-gray-700 leading-relaxed dark:text-gray-200">{artist.previousReleases}</p>
              </div>
            )}
            {artist.musicLinks && artist.musicLinks.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 block mb-2 dark:text-gray-400">Music Links</span>
                <div className="space-y-1">
                  {artist.musicLinks.filter(Boolean).map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      <ExternalLink size={10} /> {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          {artist.documents && artist.documents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400 flex items-center gap-2">
                <FileText size={14} /> Documents ({artist.documents.length})
              </h3>
              <div className="space-y-2">
                {artist.documents.map((doc) => (
                  <div key={doc._id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 dark:bg-gray-700/40 dark:border-gray-600">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={16} className="text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 font-medium truncate dark:text-gray-100">{doc.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          {' · '}{formatDate(doc.uploadedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide text-[10px] ${
                        doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800' :
                        doc.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800' :
                        'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800'
                      }`}>
                        {doc.status}
                      </span>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 flex-shrink-0 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        <ExternalLink size={12} /> View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400">Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/10">
                  <TrendingUp size={14} className="text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Streams</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatNumber(artist.totalStreams || 0)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-500/10">
                  <DollarSign size={14} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(artist.totalRevenue || 0)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-500/10">
                  <Star size={14} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Royalty Rate</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{artist.royaltyRate || 15}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400">Contact</h3>
            <div className="space-y-2">
              {artist.email && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Mail size={12} className="text-gray-400 dark:text-gray-500" /> {artist.email}
                </div>
              )}
              {artist.phone && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <Phone size={12} className="text-gray-400 dark:text-gray-500" /> {artist.phone}
                </div>
              )}
              {artist.address && artist.address.city && (
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <MapPin size={12} className="text-gray-400 dark:text-gray-500" />
                  {[artist.address.street, artist.address.city, artist.address.state, artist.address.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Contract Info */}
          {(artist.contractStart || artist.contractEnd) && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400 flex items-center gap-2">
                <Calendar size={14} /> Contract
              </h3>
              <div className="space-y-2 text-xs">
                {artist.contractStart && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Start</span>
                    <span className="text-gray-700 font-medium dark:text-gray-200">{formatDate(artist.contractStart)}</span>
                  </div>
                )}
                {artist.contractEnd && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">End</span>
                    <span className="text-gray-700 font-medium dark:text-gray-200">{formatDate(artist.contractEnd)}</span>
                  </div>
                )}
                {artist.manager && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Manager</span>
                    <span className="text-gray-700 font-medium dark:text-gray-200">{artist.manager.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emergency Contact */}
          {artist.emergencyContact?.name && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400 flex items-center gap-2">
                <Shield size={14} /> Emergency Contact
              </h3>
              <div className="space-y-1 text-xs">
                <div className="text-gray-900 font-medium dark:text-gray-100">{artist.emergencyContact.name}</div>
                <div className="text-gray-500 dark:text-gray-400">{artist.emergencyContact.relationship}</div>
                <div className="text-gray-600 dark:text-gray-300">{artist.emergencyContact.phone}</div>
                {artist.emergencyContact.email && (
                  <div className="text-gray-600 dark:text-gray-300">{artist.emergencyContact.email}</div>
                )}
              </div>
            </div>
          )}

          {/* Business Info */}
          {(artist.paymentInfo?.method || artist.taxInfo?.taxFormType) && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 dark:bg-gray-800 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-500 mb-3 dark:text-gray-400 flex items-center gap-2">
                <CreditCard size={14} /> Business Info
              </h3>
              <div className="space-y-2 text-xs">
                {artist.paymentInfo?.method && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Payment</span>
                    <span className="text-gray-700 font-medium capitalize dark:text-gray-200">{artist.paymentInfo.method.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {artist.paymentInfo?.bankName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Bank</span>
                    <span className="text-gray-700 font-medium dark:text-gray-200">{artist.paymentInfo.bankName}</span>
                  </div>
                )}
                {artist.taxInfo?.taxFormType && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Tax Form</span>
                    <span className="text-gray-700 font-medium dark:text-gray-200">{artist.taxInfo.taxFormType}</span>
                  </div>
                )}
                {artist.taxInfo?.filingStatus && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Filing</span>
                    <span className="text-gray-700 font-medium capitalize dark:text-gray-200">{artist.taxInfo.filingStatus.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-6 dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 mb-4 dark:text-gray-100">Reject Onboarding</h3>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">Please provide a reason for rejecting this artist's onboarding.</p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full h-24 resize-none mb-4 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
              placeholder="Reason for rejection..."
            />
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100">Cancel</button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectNotes.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 dark:text-red-400 dark:bg-red-500/10 dark:border-red-800 dark:hover:bg-red-500/20"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal (after auto-creating login) */}
      {createdLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCreatedLogin(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-6 dark:bg-gray-900 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 mb-2 dark:text-gray-100">Artist Login Created</h3>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">A login account was created for this artist. Share these credentials securely:</p>
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-gray-800 dark:border-gray-700">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">Email</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5 break-all dark:text-gray-100">{createdLogin.email}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide dark:text-gray-400">Temporary Password</div>
                <div className="text-sm font-mono font-semibold text-gray-900 mt-0.5 dark:text-gray-100">{createdLogin.tempPassword}</div>
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-3 dark:text-amber-400">Ask the artist to change this password after first login.</p>
            <div className="flex items-center gap-3 justify-end mt-5">
              <button onClick={() => setCreatedLogin(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Artist"
        message="Are you sure you want to delete this artist? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { setDeleteConfirmOpen(false); handleDelete(); }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default ArtistProfile;
