import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User, Music, FileCheck, CheckCircle, ArrowLeft, ArrowRight,
  Save, Plus, X, Send, AtSign, Video, MessageCircle, Globe, Music2,
  Camera, AlertTriangle, Trash2, Image as ImageIcon, BookOpen, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { artistsApi } from '../services/api';
import OnboardingProgress from '../components/onboarding/OnboardingProgress';
import FileUpload from '../components/onboarding/FileUpload';
import type { Artist, ArtistDocument } from '../types';

interface ValidationErrors { [key: string]: string; }

const ONBOARDING_PACKAGE_SECTIONS = [
  {
    title: 'How HBE works',
    body: 'Your manager is the main point of contact. Project tasks, deadlines, files, approvals, and notes must be kept in the HBE platform so the team has one reliable source of truth.',
  },
  {
    title: 'Music creation and delivery',
    body: 'Songs follow the standard 12-step production workflow. Deliver sessions, stems, masters, alternate versions, lyrics, credits, split sheets, and supporting agreements through the approved folder structure.',
  },
  {
    title: 'Rights and approvals',
    body: 'Do not release music until master ownership, songwriter shares, producer terms, samples, licenses, metadata, and required signatures are confirmed. HBE approval is required at the workflow checkpoints assigned to you.',
  },
  {
    title: 'Releases and marketing',
    body: 'Release dates, artwork, metadata, distribution, content schedules, interviews, advertising, and post-release reporting are coordinated through the release and campaign systems. Meet assigned deadlines and flag blockers early.',
  },
  {
    title: 'Payments and royalties',
    body: 'Keep payment and tax details current. Royalty statements show income sources, deductions, recoupment, share calculations, payments, and remaining balances. Questions or disputes should be submitted to the finance team promptly.',
  },
  {
    title: 'Professional standards',
    body: 'Follow the code of conduct, confidentiality terms, social-media expectations, recording requirements, and approved communication channels. Protect passwords, private files, unreleased music, and personal information.',
  },
];

const ArtistOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const [legalName, setLegalName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState({ street: '', city: '', state: '', zipCode: '', country: '' });
  const [emergencyContact, setEmergencyContact] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState({ instagram: '', tiktok: '', youtube: '', spotify: '', twitter: '' });

  const [genre, setGenre] = useState('');
  const [musicLinks, setMusicLinks] = useState<string[]>(['']);
  const [previousReleases, setPreviousReleases] = useState('');
  const [catalogOwnership, setCatalogOwnership] = useState('');
  const [proAffiliation, setProAffiliation] = useState('');
  const [publisher, setPublisher] = useState({ name: '', contact: '' });
  const [paymentInfo, setPaymentInfo] = useState({ method: '', bankName: '', accountNumber: '', routingNumber: '', paypalEmail: '' });
  const [taxInfo, setTaxInfo] = useState({ taxId: '', taxFormType: '', filingStatus: '' });

  const [documents, setDocuments] = useState<ArtistDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [onboardingNotes, setOnboardingNotes] = useState('');
  const [packageAcknowledged, setPackageAcknowledged] = useState(false);
  const [submissionMissing, setSubmissionMissing] = useState<string[]>([]);

  useEffect(() => {
    if (isEditing && id && artist?._id !== id) loadArtist(id);
  }, [id, isEditing, artist?._id]);

  const loadArtist = async (artistId: string) => {
    try {
      const res = await artistsApi.getById(artistId);
      const a = res.data.data;
      setArtist(a);
      setLegalName(a.legalName || a.name || '');
      setArtistName(a.artistName || a.stageName || '');
      setEmail(a.email || '');
      setPhone(a.phone || '');
      setDateOfBirth(a.dateOfBirth ? a.dateOfBirth.split('T')[0] : '');
      if (a.address) setAddress(a.address);
      if (a.emergencyContact) setEmergencyContact(a.emergencyContact);
      setBio(a.bio || '');
      if (a.socialLinks) setSocialLinks(a.socialLinks);
      setGenre(a.genre || '');
      setMusicLinks(a.musicLinks?.length ? a.musicLinks : ['']);
      setPreviousReleases(a.previousReleases || '');
      setCatalogOwnership(a.catalogOwnership || '');
      setProAffiliation(a.proAffiliation || '');
      if (a.publisher) setPublisher(a.publisher);
      if (a.paymentInfo) setPaymentInfo(a.paymentInfo);
      if (a.taxInfo) setTaxInfo(a.taxInfo);
      if (a.documents) setDocuments(a.documents);
      setStep(a.onboardingStep || 1);
      setOnboardingNotes(a.onboardingNotes || '');
      setPackageAcknowledged(Boolean(a.onboardingPackage?.acknowledgedAt));
    } catch (e) { toast.error('Failed to load artist'); navigate('/artists'); }
  };

  const validateStep = (s: number): boolean => {
    const e: ValidationErrors = {};
    if (s === 1) {
      if (!legalName.trim()) e.legalName = 'Legal name is required';
      if (!artistName.trim()) e.artistName = 'Artist name is required';
      if (!email.trim()) e.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email format';
      if (!phone.trim()) e.phone = 'Phone number is required';
    }
    if (s === 2 && !genre) e.genre = 'Genre is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleBlur = (field: string) => { setTouched(p => ({ ...p, [field]: true })); validateStep(step); };
  const getFieldError = (f: string): string | null => (!touched[f] && !errors[f]) ? null : errors[f] || null;

  const handleSaveStep = async (): Promise<boolean> => {
    if (!validateStep(step)) { toast.error('Please fix the errors before saving'); return false; }
    setSaving(true);
    try {
      let data: Record<string, unknown> = {};
      if (step === 1) data = { legalName, artistName, email, phone, dateOfBirth, address, emergencyContact, bio, socialLinks };
      else if (step === 2) data = { genre, musicLinks: musicLinks.filter(Boolean), previousReleases, catalogOwnership, proAffiliation, publisher, paymentInfo, taxInfo };
      const res = artist
        ? await artistsApi.updateOnboardingStep(artist._id, step, data)
        : await artistsApi.create(data);
      setArtist(res.data.data);
      if (!artist) {
        navigate(`/artists/onboarding/${res.data.data._id}`, { replace: true });
        toast.success('Artist created. You can now upload profile photos.');
      } else {
        toast.success('Progress saved');
      }
      setSaving(false);
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
      setSaving(false);
      return false;
    }
  };

  const handleNext = async () => {
    if (!validateStep(step)) { setTouched({ legalName: true, artistName: true, email: true, phone: true, genre: true }); toast.error('Please fill in all required fields'); return; }
    const saved = await handleSaveStep();
    if (saved && step < 4) setStep(step + 1);
  };

  const handleSubmitForApproval = async () => {
    if (!artist) return;
    setSubmissionMissing([]);
    if (uploadedCount !== requiredDocs.length) {
      toast.error('Upload every required onboarding document before submission');
      setStep(3);
      return;
    }
    if (!packageAcknowledged) {
      toast.error('Confirm that the artist received and reviewed the HBE onboarding package');
      return;
    }
    setSubmitting(true);
    try { const res = await artistsApi.submitForApproval(artist._id, packageAcknowledged, onboardingNotes); setArtist(res.data.data); toast.success('Submitted for approval!'); navigate('/artists'); }
    catch (e: any) {
      const missing = e.response?.data?.missingItems || [];
      setSubmissionMissing(missing);
      toast.error(e.response?.data?.message || 'Failed to submit');
    }
    setSubmitting(false);
  };

  const downloadOnboardingPackage = () => {
    const content = [
      'HBE ARTIST ONBOARDING PACKAGE',
      `Prepared for: ${artistName || 'New Artist'}`,
      'Version 1.0',
      '',
      ...ONBOARDING_PACKAGE_SECTIONS.flatMap(section => [section.title.toUpperCase(), section.body, '']),
      'ACKNOWLEDGEMENT',
      'I confirm that I received, reviewed, and understand this onboarding package and the related agreements provided by HBE.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `HBE-Onboarding-Package-${(artistName || 'Artist').replace(/[^a-z0-9]+/gi, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadDocument = async (file: File, docType: string, docName: string) => {
    if (!artist) return;
    const fd = new FormData(); fd.append('file', file); fd.append('type', docType); fd.append('name', docName);
    setUploadingDoc(docType);
    try { const res = await artistsApi.uploadDocument(artist._id, fd); setArtist(res.data.data); setDocuments(res.data.data.documents); toast.success('Document uploaded'); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Upload failed'); }
    setUploadingDoc(null);
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!artist) return;
    try { const res = await artistsApi.removeDocument(artist._id, docId); setArtist(res.data.data); setDocuments(res.data.data.documents); toast.success('Document removed'); }
    catch (e: any) { toast.error('Failed to remove document'); }
  };

  const handleImageUpload = async (file: File, field: 'image' | 'coverPhoto') => {
    if (!artist) return;
    const fd = new FormData(); fd.append('file', file); fd.append('field', field);
    setUploadingImage(field);
    try { const res = await artistsApi.uploadImage(artist._id, fd); setArtist(res.data.data); toast.success(field === 'image' ? 'Profile photo updated' : 'Cover photo updated'); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Upload failed'); }
    setUploadingImage(null);
  };

  const handleRemoveImage = async (field: 'image' | 'coverPhoto') => {
    if (!artist || !window.confirm(`Remove this ${field === 'image' ? 'profile' : 'cover'} photo?`)) return;
    setUploadingImage(field);
    try {
      const res = await artistsApi.removeImage(artist._id, field);
      setArtist(res.data.data);
      toast.success(`${field === 'image' ? 'Profile' : 'Cover'} photo removed`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to remove image');
    }
    setUploadingImage(null);
  };

  const addMusicLink = () => setMusicLinks([...musicLinks, '']);
  const removeMusicLink = (i: number) => { if (musicLinks.length > 1) setMusicLinks(musicLinks.filter((_, idx) => idx !== i)); };
  const updateMusicLink = (i: number, v: string) => { const u = [...musicLinks]; u[i] = v; setMusicLinks(u); };

  const requiredDocs = [
    { type: 'artist_agreement', label: 'Artist Agreement', name: 'Artist Agreement' },
    { type: 'tax_form', label: 'Tax Form (W-9)', name: 'Tax Form' },
    { type: 'nda', label: 'Non-Disclosure Agreement', name: 'NDA' },
    { type: 'image_release', label: 'Image Release Form', name: 'Image Release' },
    { type: 'payment_instructions', label: 'Payment Instructions', name: 'Payment Instructions' },
    { type: 'code_of_conduct', label: 'Code of Conduct Agreement', name: 'Code of Conduct' },
    { type: 'social_media_expectations', label: 'Social-Media Expectations', name: 'Social-Media Expectations' },
    { type: 'recording_delivery_requirements', label: 'Recording & Delivery Requirements', name: 'Recording & Delivery Requirements' },
  ];
  const getDocForType = (t: string) => documents.find(d => d.type === t);
  const uploadedCount = requiredDocs.filter(d => getDocForType(d.type)).length;

  const genres = ['Hip-Hop', 'R&B', 'Pop', 'Rock', 'Afrobeats', 'Trap', 'Rap', 'Soul', 'Jazz', 'Electronic', 'Dance', 'Latin', 'Reggae', 'Country', 'Classical', 'Gospel', 'Alternative', 'Indie', 'Metal', 'Blues', 'Folk'];

  const fieldErr = (f: string) => {
    const err = getFieldError(f);
    if (!err) return null;
    return <div className="flex items-center gap-1 mt-1"><AlertTriangle size={11} className="text-red-500" /><span className="text-[11px] text-red-500">{err}</span></div>;
  };
  const inputCls = (f: string) => `w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 ${getFieldError(f) ? '!border-red-400 !shadow-none' : ''}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/artists')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors dark:hover:bg-gray-700">
          <ArrowLeft size={20} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{isEditing ? 'Continue Onboarding' : 'New Artist Onboarding'}</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">{isEditing ? 'Complete the remaining steps' : 'Register a new artist on the label'}</p>
        </div>
          {isEditing && artist && <button onClick={() => navigate(`/artists/${artist._id}`)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 text-sm dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100">View Profile</button>}
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600">
        <OnboardingProgress currentStep={step} onboardingStatus={artist?.onboardingStatus || 'not_started'} />
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 p-6 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6 animate-step-enter">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10"><User size={18} className="text-indigo-600 dark:text-indigo-400" /></div>
              <div><h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Personal Information</h2><p className="text-xs text-gray-500 dark:text-gray-400">Basic details and contact information</p></div>
            </div>

            {isEditing && artist && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-700 mb-3 dark:text-gray-200">Profile Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-xl overflow-hidden bg-gray-200 dark:bg-gray-600">
                      {artist.image ? <img src={artist.image} alt="Profile" className="w-full h-full object-cover" /> : <Camera size={24} className="text-gray-400 dark:text-gray-500" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input ref={profileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'image'); }} className="hidden" />
                      <button onClick={() => profileInputRef.current?.click()} disabled={uploadingImage === 'image'} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 text-xs flex items-center gap-2 w-full justify-center dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100">
                        <Camera size={12} />{uploadingImage === 'image' ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      {artist.image && <button onClick={() => handleRemoveImage('image')} disabled={uploadingImage === 'image'} className="px-4 py-2 bg-white text-red-500 font-medium rounded-lg text-sm border border-red-200 hover:bg-red-50 transition-all duration-200 text-xs flex items-center gap-2 w-full justify-center dark:bg-gray-800 dark:border-red-900/50"><Trash2 size={12} />Remove Photo</button>}
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                  <label className="block text-sm font-medium text-gray-700 mb-3 dark:text-gray-200">Cover Photo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-20 rounded-xl flex items-center justify-center overflow-hidden bg-gray-200 dark:bg-gray-600">
                      {artist.coverPhoto ? <img src={artist.coverPhoto} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-gray-400 dark:text-gray-500" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'coverPhoto'); }} className="hidden" />
                      <button onClick={() => coverInputRef.current?.click()} disabled={uploadingImage === 'coverPhoto'} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 text-xs flex items-center gap-2 w-full justify-center dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100">
                        <ImageIcon size={12} />{uploadingImage === 'coverPhoto' ? 'Uploading...' : 'Upload Cover'}
                      </button>
                      {artist.coverPhoto && <button onClick={() => handleRemoveImage('coverPhoto')} disabled={uploadingImage === 'coverPhoto'} className="px-4 py-2 bg-white text-red-500 font-medium rounded-lg text-sm border border-red-200 hover:bg-red-50 transition-all duration-200 text-xs flex items-center gap-2 w-full justify-center dark:bg-gray-800 dark:border-red-900/50"><Trash2 size={12} />Remove Cover</button>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Legal Name <span className="text-red-500">*</span></label>
                <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} onBlur={() => handleBlur('legalName')} className={inputCls('legalName')} placeholder="Full legal name" />
                {fieldErr('legalName')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Artist / Stage Name <span className="text-red-500">*</span></label>
                <input type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)} onBlur={() => handleBlur('artistName')} className={inputCls('artistName')} placeholder="Stage or artist name" />
                {fieldErr('artistName')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Email <span className="text-red-500">*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => handleBlur('email')} className={inputCls('email')} placeholder="artist@email.com" />
                {fieldErr('email')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Phone <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => handleBlur('phone')} className={inputCls('phone')} placeholder="+1 (555) 000-0000" />
                {fieldErr('phone')}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Date of Birth</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Address</label>
              <input type="text" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Street address" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <input type="text" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="City" />
                <input type="text" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="State" />
                <input type="text" value={address.zipCode} onChange={(e) => setAddress({ ...address, zipCode: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="ZIP Code" />
                <input type="text" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Country" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Emergency Contact</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input type="text" value={emergencyContact.name} onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Contact name" />
                <input type="text" value={emergencyContact.relationship} onChange={(e) => setEmergencyContact({ ...emergencyContact, relationship: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Relationship" />
                <input type="tel" value={emergencyContact.phone} onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Phone" />
                <input type="email" value={emergencyContact.email} onChange={(e) => setEmergencyContact({ ...emergencyContact, email: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Email" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Biography</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 h-28 resize-none" placeholder="Artist biography..." />
              <div className="text-xs text-gray-400 mt-1 text-right dark:text-gray-500">{bio.length}/2000</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Social Media Links</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2"><AtSign size={16} className="text-pink-500 flex-shrink-0" /><input type="url" value={socialLinks.instagram} onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Instagram URL" /></div>
                <div className="flex items-center gap-2"><Globe size={16} className="text-cyan-500 flex-shrink-0" /><input type="url" value={socialLinks.tiktok} onChange={(e) => setSocialLinks({ ...socialLinks, tiktok: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="TikTok URL" /></div>
                <div className="flex items-center gap-2"><Video size={16} className="text-red-500 flex-shrink-0" /><input type="url" value={socialLinks.youtube} onChange={(e) => setSocialLinks({ ...socialLinks, youtube: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="YouTube URL" /></div>
                <div className="flex items-center gap-2"><Music2 size={16} className="text-green-500 flex-shrink-0" /><input type="url" value={socialLinks.spotify} onChange={(e) => setSocialLinks({ ...socialLinks, spotify: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Spotify URL" /></div>
                <div className="flex items-center gap-2"><MessageCircle size={16} className="text-blue-500 flex-shrink-0" /><input type="url" value={socialLinks.twitter} onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Twitter / X URL" /></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6 animate-step-enter">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/10"><Music size={18} className="text-cyan-600 dark:text-cyan-400" /></div>
              <div><h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Music Information</h2><p className="text-xs text-gray-500 dark:text-gray-400">Genre, links, and catalog details</p></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Primary Genre <span className="text-red-500">*</span></label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} onBlur={() => handleBlur('genre')} className={inputCls('genre')}>
                <option value="">Select genre...</option>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {fieldErr('genre')}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Music Links</label>
                <button type="button" onClick={addMusicLink} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"><Plus size={12} /> Add Link</button>
              </div>
              <div className="space-y-2">
                {musicLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="url" value={link} onChange={(e) => updateMusicLink(idx, e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 flex-1" placeholder="https://open.spotify.com/..." />
                    {musicLinks.length > 1 && <button type="button" onClick={() => removeMusicLink(idx)} className="text-gray-400 hover:text-red-500 p-1 dark:text-gray-500 dark:hover:text-red-400"><X size={14} /></button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Previous Releases</label>
              <textarea value={previousReleases} onChange={(e) => setPreviousReleases(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 h-24 resize-none" placeholder="List previous releases, albums, singles..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Existing Catalog Ownership</label>
              <textarea value={catalogOwnership} onChange={(e) => setCatalogOwnership(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 h-20 resize-none" placeholder="Describe ownership of existing catalog..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">PRO Affiliation</label>
                <select value={proAffiliation} onChange={(e) => setProAffiliation(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500">
                  <option value="">Select PRO...</option>
                  <option value="ASCAP">ASCAP</option><option value="BMI">BMI</option><option value="SESAC">SESAC</option>
                  <option value="GMR">GMR</option><option value="PRC">PRC</option><option value="Other">Other</option><option value="None">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Publisher Name</label>
                <input type="text" value={publisher.name} onChange={(e) => setPublisher({ ...publisher, name: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Publisher name" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Publisher Contact</label>
              <input type="text" value={publisher.contact} onChange={(e) => setPublisher({ ...publisher, contact: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Publisher contact email or phone" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Payment Information</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Payment Method</label>
                  <select value={paymentInfo.method} onChange={(e) => setPaymentInfo({ ...paymentInfo, method: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500">
                    <option value="">Select method...</option><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option><option value="check">Check</option><option value="wire">Wire Transfer</option>
                  </select></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Bank Name</label><input type="text" value={paymentInfo.bankName} onChange={(e) => setPaymentInfo({ ...paymentInfo, bankName: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Bank name" /></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Account Number</label><input type="text" value={paymentInfo.accountNumber} onChange={(e) => setPaymentInfo({ ...paymentInfo, accountNumber: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Account number" /></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Routing Number</label><input type="text" value={paymentInfo.routingNumber} onChange={(e) => setPaymentInfo({ ...paymentInfo, routingNumber: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Routing number" /></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">PayPal Email</label><input type="email" value={paymentInfo.paypalEmail} onChange={(e) => setPaymentInfo({ ...paymentInfo, paypalEmail: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="paypal@email.com" /></div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Tax Information</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Tax ID / SSN</label><input type="text" value={taxInfo.taxId} onChange={(e) => setTaxInfo({ ...taxInfo, taxId: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" placeholder="XXX-XX-XXXX" /></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Tax Form Type</label>
                  <select value={taxInfo.taxFormType} onChange={(e) => setTaxInfo({ ...taxInfo, taxFormType: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500">
                    <option value="">Select...</option><option value="W-9">W-9</option><option value="W-8BEN">W-8BEN</option><option value="W-8BEN-E">W-8BEN-E</option><option value="1099">1099</option>
                  </select></div>
                <div><label className="block text-xs text-gray-500 mb-1 dark:text-gray-400">Filing Status</label>
                  <select value={taxInfo.filingStatus} onChange={(e) => setTaxInfo({ ...taxInfo, filingStatus: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500">
                    <option value="">Select...</option><option value="single">Single</option><option value="married_filing_jointly">Married Filing Jointly</option><option value="married_filing_separately">Married Filing Separately</option><option value="head_of_household">Head of Household</option><option value="corporation">Corporation</option><option value="llc">LLC</option>
                  </select></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6 animate-step-enter">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-500/10"><FileCheck size={18} className="text-amber-600 dark:text-amber-400" /></div>
              <div className="flex-1"><h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Documents</h2><p className="text-xs text-gray-500 dark:text-gray-400">Upload required onboarding documents</p></div>
              <div className="text-right"><span className="text-sm font-bold text-amber-600 dark:text-amber-400">{uploadedCount}</span><span className="text-sm text-gray-500 dark:text-gray-400">/{requiredDocs.length}</span></div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Document Completion</span>
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{Math.round((uploadedCount / requiredDocs.length) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-gray-200 overflow-hidden dark:bg-gray-600">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(uploadedCount / requiredDocs.length) * 100}%`, background: uploadedCount === requiredDocs.length ? '#10B981' : '#4F46E5' }} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requiredDocs.map(doc => {
                const existing = getDocForType(doc.type);
                return (
                  <div key={doc.type} className="p-4 rounded-xl bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                    <FileUpload label={doc.label} currentFile={existing?.fileName} onChange={(file) => handleUploadDocument(file, doc.type, doc.name)} onRemove={() => existing && handleRemoveDocument(existing._id)} disabled={uploadingDoc === doc.type} />
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 mb-3 dark:text-gray-300">Additional Documents (Existing Contracts, etc.)</p>
              <FileUpload label="Upload Additional Document" onChange={(file) => handleUploadDocument(file, 'existing_contract', file.name)} disabled={!!uploadingDoc} />
            </div>

            {documents.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-200">Uploaded Documents ({documents.length})</h3>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc._id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-700/40 dark:border-gray-600">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileCheck size={16} className="text-amber-500 flex-shrink-0" />
                        <div className="min-w-0"><div className="text-sm text-gray-900 truncate font-medium dark:text-gray-100">{doc.name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{doc.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div></div>
                      </div>
                      <button onClick={() => handleRemoveDocument(doc._id)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0 dark:text-gray-500 dark:hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-6 animate-step-enter">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10"><CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" /></div>
              <div><h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Review & Submit</h2><p className="text-xs text-gray-500 dark:text-gray-400">Review all information before submitting</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-800">
                <h3 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2 dark:text-indigo-400"><User size={14} /> Personal Information</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Legal Name</span><span className="text-gray-900 dark:text-gray-100">{legalName || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Artist Name</span><span className="text-gray-900 dark:text-gray-100">{artistName || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Email</span><span className="text-gray-900 dark:text-gray-100">{email || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Phone</span><span className="text-gray-900 dark:text-gray-100">{phone || '-'}</span></div>
                </div>
                <button onClick={() => setStep(1)} className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium dark:text-indigo-400 dark:hover:text-indigo-300">Edit Personal Info</button>
              </div>

              <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-800">
                <h3 className="text-sm font-semibold text-cyan-700 mb-3 flex items-center gap-2 dark:text-cyan-400"><Music size={14} /> Music Information</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Genre</span><span className="text-gray-900 dark:text-gray-100">{genre || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">PRO</span><span className="text-gray-900 dark:text-gray-100">{proAffiliation || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Publisher</span><span className="text-gray-900 dark:text-gray-100">{publisher.name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Music Links</span><span className="text-gray-900 dark:text-gray-100">{musicLinks.filter(Boolean).length} link(s)</span></div>
                </div>
                <button onClick={() => setStep(2)} className="mt-3 text-xs text-cyan-600 hover:text-cyan-700 font-medium dark:text-cyan-400 dark:hover:text-cyan-300">Edit Music Info</button>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-800">
                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2 dark:text-amber-400"><FileCheck size={14} /> Documents</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total Uploaded</span><span className="text-gray-900 dark:text-gray-100">{documents.length} document(s)</span></div>
                  {requiredDocs.map(doc => { const found = getDocForType(doc.type); return (<div key={doc.type} className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">{doc.label}</span><span className={found ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}>{found ? 'Uploaded' : 'Missing'}</span></div>); })}
                </div>
                <button onClick={() => setStep(3)} className="mt-3 text-xs text-amber-600 hover:text-amber-700 font-medium dark:text-amber-400 dark:hover:text-amber-300">Edit Documents</button>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-800">
                <h3 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2 dark:text-emerald-400"><CheckCircle size={14} /> Onboarding Status</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Step Completed</span><span className="text-gray-900 dark:text-gray-100">{step} of 4</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Status</span><span className="text-amber-600 capitalize dark:text-amber-400">{artist?.onboardingStatus?.replace(/_/g, ' ') || 'In Progress'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Documents</span><span className={uploadedCount === requiredDocs.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>{uploadedCount}/{requiredDocs.length}</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden dark:border-indigo-800 dark:bg-indigo-500/5">
              <div className="p-4 border-b border-indigo-200 flex flex-wrap items-center justify-between gap-3 dark:border-indigo-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center dark:bg-indigo-500/10">
                    <BookOpen size={17} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">HBE Artist Onboarding Package</h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Version 1.0 · How the label operates</p>
                  </div>
                </div>
                <button type="button" onClick={downloadOnboardingPackage} className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-2 dark:bg-gray-800 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
                  <Download size={13} /> Download Package
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                {ONBOARDING_PACKAGE_SECTIONS.map(section => (
                  <div key={section.title} className="rounded-lg bg-white border border-indigo-100 p-3 dark:bg-gray-800 dark:border-indigo-900">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{section.title}</h4>
                    <p className="text-[11px] leading-relaxed text-gray-600 mt-1 dark:text-gray-300">{section.body}</p>
                  </div>
                ))}
              </div>
              <label className="m-4 mt-0 p-3 rounded-lg bg-white border border-indigo-200 flex items-start gap-3 cursor-pointer dark:bg-gray-800 dark:border-indigo-800">
                <input
                  type="checkbox"
                  checked={packageAcknowledged}
                  onChange={event => setPackageAcknowledged(event.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                  I confirm that the artist received and reviewed the HBE onboarding package and understands the label workflow, approval, delivery, rights, payment, and professional-conduct expectations.
                  {artist?.onboardingPackage?.acknowledgedAt && <span className="block text-emerald-600 font-medium mt-1 dark:text-emerald-400">Acknowledged {new Date(artist.onboardingPackage.acknowledgedAt).toLocaleDateString()}</span>}
                </span>
              </label>
            </div>

            {submissionMissing.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-500/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle size={15} /> Complete these items before submission
                </div>
                <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-red-600 list-disc list-inside dark:text-red-400">
                  {submissionMissing.map(item => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 dark:text-gray-200">Additional Notes</label>
              <textarea value={onboardingNotes} onChange={(e) => setOnboardingNotes(e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 w-full dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500 h-24 resize-none" placeholder="Any additional notes or comments..." />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>{step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100"><ArrowLeft size={14} /> Previous</button>}</div>
        <div className="flex items-center gap-3">
          {step < 4 ? (
            <>
              <button onClick={handleSaveStep} disabled={saving} className="px-4 py-2 bg-white text-gray-600 font-medium rounded-lg text-sm border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center gap-2 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-100"><Save size={14} /> {saving ? 'Saving...' : artist ? 'Save Progress' : 'Create Artist'}</button>
              <button onClick={handleNext} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2">Next Step <ArrowRight size={14} /></button>
            </>
          ) : (
            <button onClick={handleSubmitForApproval} disabled={submitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700" style={{ background: '#059669' }}>
              <Send size={14} /> {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtistOnboarding;
