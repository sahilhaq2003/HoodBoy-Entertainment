import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FolderOpen, File, Upload, Search, ChevronRight, Home, Grid, List,
  Star, Download, Trash2, FolderPlus, Eye, Tag, Cloud, HardDrive,
  ArrowUpRight, MoreVertical, X, FileText, Image, Music, Video,
  Archive, RefreshCw, CheckCircle, AlertTriangle, Info,
} from 'lucide-react';
import { fileManagerApi } from '../services/api';
import type { FileItem, FolderItem, FolderContents, StorageStats, Breadcrumb, SearchResults } from '../types';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getApiErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const formatVerifiedAt = (value?: string) => value ? new Date(value).toLocaleString() : 'Not verified';

const getFileIcon = (type: string, mimeType: string) => {
  if (type === 'image') return <Image size={18} className="text-pink-500" />;
  if (type === 'audio') return <Music size={18} className="text-purple-500" />;
  if (type === 'video') return <Video size={18} className="text-red-500" />;
  if (type === 'archive') return <Archive size={18} className="text-yellow-500" />;
  if (mimeType?.includes('pdf')) return <FileText size={18} className="text-red-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <FileText size={18} className="text-blue-500" />;
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return <FileText size={18} className="text-green-500" />;
  return <File size={18} className="text-gray-400" />;
};

const getFolderIcon = (icon: string) => {
  const icons: Record<string, React.ReactNode> = {
    users: <span className="text-purple-600 text-sm font-bold">👥</span>,
    radio: <span className="text-cyan-600 text-sm font-bold">📻</span>,
    'file-text': <span className="text-green-600 text-sm font-bold">📄</span>,
    'dollar-sign': <span className="text-yellow-600 text-sm font-bold">💲</span>,
    shield: <span className="text-red-600 text-sm font-bold">🛡️</span>,
    'shopping-bag': <span className="text-pink-600 text-sm font-bold">🛍️</span>,
    layout: <span className="text-indigo-600 text-sm font-bold">📋</span>,
    user: <span className="text-purple-600 text-sm font-bold">👤</span>,
    music: <span className="text-purple-600 text-sm font-bold">🎵</span>,
    camera: <span className="text-cyan-600 text-sm font-bold">📷</span>,
    video: <span className="text-pink-600 text-sm font-bold">🎬</span>,
    'trending-up': <span className="text-green-600 text-sm font-bold">📈</span>,
    star: <span className="text-yellow-600 text-sm font-bold">⭐</span>,
    mic: <span className="text-purple-600 text-sm font-bold">🎤</span>,
    headphones: <span className="text-pink-600 text-sm font-bold">🎧</span>,
    layers: <span className="text-cyan-600 text-sm font-bold">📚</span>,
    sliders: <span className="text-yellow-600 text-sm font-bold">🎚️</span>,
    award: <span className="text-green-600 text-sm font-bold">🏆</span>,
    image: <span className="text-red-600 text-sm font-bold">🖼️</span>,
    'pen-tool': <span className="text-indigo-600 text-sm font-bold">✏️</span>,
    'file-check': <span className="text-orange-600 text-sm font-bold">✅</span>,
    database: <span className="text-gray-600 text-sm font-bold">🗄️</span>,
    package: <span className="text-purple-600 text-sm font-bold">📦</span>,
  };
  return icons[icon] || <span className="text-sm">📁</span>;
};

const FileManager: React.FC = () => {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ type: 'file' | 'folder'; id: string; x: number; y: number } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [showArtistStructure, setShowArtistStructure] = useState(false);
  const [showSongStructure, setShowSongStructure] = useState(false);
  const [artistName, setArtistName] = useState('');
  const [songName, setSongName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'file' | 'folder'; id: string } | null>(null);

  const loadRoot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fileManagerApi.getRoot();
      setFolders(res.data.data.folders);
      setFiles([]);
      setCurrentFolder(null);
      setBreadcrumbs([]);
    } catch { toast.error('Failed to load storage'); }
    finally { setLoading(false); }
  }, []);

  const loadFolder = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await fileManagerApi.getFolder(id);
      const data: FolderContents = res.data.data;
      setFolders(data.folders);
      setFiles(data.files);
      setCurrentFolder(data.folder);
      setBreadcrumbs(data.breadcrumbs);
    } catch { toast.error('Failed to load folder'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (folderId) loadFolder(folderId);
    else loadRoot();
  }, [folderId, loadFolder, loadRoot]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const loadProtectedPreview = async () => {
      setPreviewUrl(null);
      if (!previewFile || !isImagePreview(previewFile.mimeType)) return;
      try {
        const response = await fileManagerApi.getContent(previewFile._id);
        objectUrl = URL.createObjectURL(response.data);
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) toast.error('Unable to load protected preview');
      }
    };
    loadProtectedPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewFile]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) { setIsSearching(false); setSearchResults(null); return; }
    try {
      setIsSearching(true);
      const res = await fileManagerApi.search(q);
      setSearchResults(res.data.data);
    } catch { toast.error('Search failed'); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;
    await uploadFiles(droppedFiles);
  };

  const uploadFiles = async (fileList: File[]) => {
    try {
      setUploading(true);
      for (const f of fileList) {
        const formData = new FormData();
        formData.append('file', f);
        if (folderId) formData.append('folderId', folderId);
        await fileManagerApi.upload(formData);
      }
      toast.success(`${fileList.length} file(s) uploaded`);
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Upload failed')); }
    finally { setUploading(false); }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await uploadFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await fileManagerApi.createFolder({ name: newFolderName, parentId: folderId });
      toast.success('Folder created');
      setShowCreateFolder(false);
      setNewFolderName('');
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to create folder')); }
  };

  const handleCreateArtistStructure = async () => {
    if (!artistName.trim()) return;
    try {
      await fileManagerApi.createArtistStructure({ artistName });
      toast.success(`Artist folder "${artistName}" created with all subfolders`);
      setShowArtistStructure(false);
      setArtistName('');
      loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to create artist structure')); }
  };

  const handleCreateSongStructure = async () => {
    if (!songName.trim()) return;
    try {
      await fileManagerApi.createSongStructure({ songName, parentFolderId: folderId });
      toast.success(`Song folder "${songName}" created with all subfolders`);
      setShowSongStructure(false);
      setSongName('');
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to create song structure')); }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await fileManagerApi.deleteFolder(id);
      toast.success('Folder deleted');
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to delete folder')); }
  };

  const handleRenameFolder = async (id: string) => {
    if (!editFolderName.trim()) return;
    try {
      await fileManagerApi.renameFolder(id, editFolderName);
      toast.success('Folder renamed');
      setEditingFolder(null);
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to rename folder')); }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      await fileManagerApi.deleteFile(id);
      toast.success('File deleted');
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to delete file')); }
  };

  const handleToggleStar = async (id: string) => {
    try {
      await fileManagerApi.toggleStar(id);
      setFiles(prev => prev.map(f => f._id === id ? { ...f, starred: !f.starred } : f));
    } catch { toast.error('Failed to update'); }
  };

  const handleBackup = async (id: string, target: string) => {
    try {
      const response = await fileManagerApi.backupFile(id, target);
      const updatedFile: FileItem = response.data.data;
      toast.success(`Backup to ${target} verified`);
      setPreviewFile(updatedFile);
      setFiles(previous => previous.map(file => file._id === updatedFile._id ? updatedFile : file));
    } catch (error) { toast.error(getApiErrorMessage(error, 'Backup failed')); }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const response = await fileManagerApi.getContent(file._id, true);
      const objectUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.originalName || file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success('Download started');
    } catch (error) { toast.error(getApiErrorMessage(error, 'Download failed')); }
  };

  const handleInitializeStorage = async () => {
    try {
      setInitializing(true);
      const response = await fileManagerApi.initialize();
      toast.success(response.data.message || 'Standard storage folders created');
      await loadRoot();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to initialize storage'));
    } finally {
      setInitializing(false);
    }
  };

  const handleMoveFile = async (fileId: string, targetFolderId: string) => {
    try {
      await fileManagerApi.moveFile(fileId, targetFolderId);
      toast.success('File moved');
      if (folderId) loadFolder(folderId); else loadRoot();
    } catch (error) { toast.error(getApiErrorMessage(error, 'Failed to move file')); }
  };

  const loadStats = async () => {
    try {
      const res = await fileManagerApi.getStats();
      setStats(res.data.data);
      setShowStats(true);
    } catch { toast.error('Failed to load stats'); }
  };

  const toggleSelectFile = (id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectFolder = (id: string) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredFiles = files.filter(f => !filterType || f.type === filterType || f.category === filterType);

  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder', id: string) => {
    e.preventDefault();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  };

  const isImagePreview = (mimeType: string) => mimeType?.startsWith('image/');
  const isPdfPreview = (mimeType: string) => mimeType === 'application/pdf';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={24} className="text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-4rem)]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FolderOpen size={28} className="text-indigo-600" />
            File Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Organize and manage all label files</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadStats} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Info size={15} /> Storage
          </button>
          <button onClick={() => setShowArtistStructure(true)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FolderPlus size={15} /> Artist Folder
          </button>
          <button
            onClick={() => setShowSongStructure(true)}
            disabled={currentFolder?.name !== 'Music'}
            title={currentFolder?.name === 'Music' ? 'Create a song workspace here' : 'Open an artist Music folder first'}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <FolderPlus size={15} /> Song Folder
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2">
            <Upload size={15} /> Upload
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.flac,.aac,.m4a,.aiff,.mp4,.mov,.avi,.webm,.zip,.rar,.7z" />
        </div>
      </div>

      {/* Breadcrumbs + Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => navigate('/files')} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 text-gray-700">
            <Home size={14} /> Storage
          </button>
          {breadcrumbs.map((bc) => (
            <React.Fragment key={bc._id}>
              <ChevronRight size={14} className="text-gray-400" />
              <button onClick={() => navigate(`/files/folder/${bc._id}`)} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-700">
                {bc.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files & folders..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
              className="pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setIsSearching(false); setSearchResults(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Types</option>
            <option value="document">Documents</option>
            <option value="image">Images</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="archive">Archives</option>
          </select>
          {/* View toggle */}
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <Grid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-indigo-600/10 border-2 border-dashed border-indigo-400 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-12 py-10 shadow-2xl text-center">
            <Upload size={48} className="text-indigo-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-900">Drop files here to upload</p>
            <p className="text-sm text-gray-500 mt-1">Files will be added to the current folder</p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <RefreshCw size={16} className="text-indigo-600 animate-spin" />
          <span className="text-sm text-indigo-700">Uploading files...</span>
        </div>
      )}

      {/* Search results overlay */}
      {isSearching && searchResults && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Search Results for "{searchQuery}"</h3>
          {searchResults.folders.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Folders</p>
              <div className="space-y-1">
                {searchResults.folders.map(f => (
                  <button key={f._id} onClick={() => navigate(`/files/folder/${f._id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 w-full text-left">
                    <FolderOpen size={16} style={{ color: f.color }} />
                    <span className="text-sm text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{f.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {searchResults.files.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Files</p>
              <div className="space-y-1">
                {searchResults.files.map(f => (
                  <button key={f._id} onClick={() => { setPreviewFile(f); setIsSearching(false); setSearchQuery(''); setSearchResults(null); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 w-full text-left">
                    {getFileIcon(f.type, f.mimeType)}
                    <span className="text-sm text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{formatFileSize(f.size)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {searchResults.folders.length === 0 && searchResults.files.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">No results found</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && folders.length === 0 && filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FolderOpen size={36} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No files or folders</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-sm">
            This folder is empty. Upload files or create a new folder to get started.
          </p>
          <div className="flex gap-2">
            {!folderId && (
              <button
                onClick={handleInitializeStorage}
                disabled={initializing}
                className="px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                {initializing ? 'Setting up...' : 'Set Up Standard Folders'}
              </button>
            )}
            <button onClick={() => setShowCreateFolder(true)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              New Folder
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
              Upload Files
            </button>
          </div>
        </div>
      )}

      {/* Folders section */}
      {!isSearching && folders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders ({folders.length})</h3>
            <button onClick={() => setShowCreateFolder(true)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <FolderPlus size={13} /> New Folder
            </button>
          </div>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'space-y-1'}>
            {folders.map(folder => (
              <div
                key={folder._id}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder._id)}
                onClick={() => navigate(`/files/folder/${folder._id}`)}
                className={`group cursor-pointer rounded-xl transition-all hover:shadow-md border border-gray-100 ${
                  viewMode === 'grid'
                    ? 'p-4 bg-white hover:border-indigo-200'
                    : 'flex items-center gap-3 px-4 py-3 bg-white hover:border-indigo-200'
                } ${selectedFolders.has(folder._id) ? 'ring-2 ring-indigo-500 border-indigo-300' : ''}`}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${folder.color}15` }}>
                        {getFolderIcon(folder.icon)}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleContextMenu(e, 'folder', folder._id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{folder.name}</p>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${folder.color}15` }}>
                      {getFolderIcon(folder.icon)}
                    </div>
                    <span className="text-sm font-medium text-gray-900 flex-1 truncate">{folder.name}</span>
                    <span className="text-xs text-gray-400">{new Date(folder.createdAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files section */}
      {!isSearching && filteredFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Files ({filteredFiles.length})</h3>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredFiles.map(file => (
                <div
                  key={file._id}
                  onContextMenu={(e) => handleContextMenu(e, 'file', file._id)}
                  onClick={() => setPreviewFile(file)}
                  className={`group cursor-pointer rounded-xl bg-white border border-gray-100 p-4 transition-all hover:shadow-md hover:border-indigo-200 ${selectedFiles.has(file._id) ? 'ring-2 ring-indigo-500 border-indigo-300' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center">
                      {getFileIcon(file.type, file.mimeType)}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleStar(file._id); }}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-colors ${file.starred ? 'text-yellow-500 opacity-100' : 'text-gray-300 hover:text-yellow-400'}`}
                    >
                      <Star size={14} fill={file.starred ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate mb-1">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{formatFileSize(file.size)}</span>
                    {file.version > 1 && <span className="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-semibold">v{file.version}</span>}
                  </div>
                  {file.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {file.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Size</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Category</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Backup</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(file => (
                    <tr
                      key={file._id}
                      onClick={() => setPreviewFile(file)}
                      onContextMenu={(e) => handleContextMenu(e, 'file', file._id)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.type, file.mimeType)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            {file.tags.length > 0 && (
                              <div className="flex gap-1 mt-0.5">
                                {file.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleStar(file._id); }}
                            className={`ml-2 ${file.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                          >
                            <Star size={12} fill={file.starred ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatFileSize(file.size)}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs capitalize">{file.category.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {file.backup.cloud && <Cloud size={12} className="text-green-500" />}
                          {file.backup.external && <HardDrive size={12} className="text-blue-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{new Date(file.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'folder' ? (
            <>
              <button onClick={() => navigate(`/files/folder/${contextMenu.id}`)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <FolderOpen size={14} /> Open
              </button>
              <button onClick={() => {
                const folder = folders.find(f => f._id === contextMenu.id);
                if (folder) { setEditingFolder(contextMenu.id); setEditFolderName(folder.name); }
                setContextMenu(null);
              }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Tag size={14} /> Rename
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { if (contextMenu) setDeleteTarget({ type: 'folder', id: contextMenu.id }); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { const f = files.find(f => f._id === contextMenu.id); if (f) setPreviewFile(f); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Eye size={14} /> Preview
              </button>
              <button onClick={() => { handleToggleStar(contextMenu.id); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Star size={14} /> Star
              </button>
              <button onClick={() => { const f = files.find(f => f._id === contextMenu.id); if (f) setPreviewFile(f); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Cloud size={14} /> Backup
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => { if (contextMenu) setDeleteTarget({ type: 'file', id: contextMenu.id }); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Create folder modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Create New Folder</h3>
            <input
              type="text" placeholder="Folder name" value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Artist structure modal */}
      {showArtistStructure && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Create Artist Folder Structure</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Creates: Music, Contracts, Photos, Videos, Marketing, Royalties</p>
            <input
              type="text" placeholder="Artist name" value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateArtistStructure()}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowArtistStructure(false); setArtistName(''); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateArtistStructure} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Song structure modal */}
      {showSongStructure && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Create Song Folder Structure</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Creates this song inside {currentFolder?.path}: Recording Session, Beat, Stems, Rough Mixes, Final Masters, Artwork, Lyrics, and more</p>
            <input
              type="text" placeholder="Song name" value={songName}
              onChange={(e) => setSongName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSongStructure()}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowSongStructure(false); setSongName(''); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateSongStructure} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename folder modal */}
      {editingFolder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Rename Folder</h3>
            <input
              type="text" placeholder="Folder name" value={editFolderName}
              onChange={(e) => setEditFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder(editingFolder)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setEditingFolder(null); setEditFolderName(''); }} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => handleRenameFolder(editingFolder)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* File preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setPreviewFile(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col dark:bg-gray-900 dark:border dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {getFileIcon(previewFile.type, previewFile.mimeType)}
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{previewFile.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(previewFile.size)} · {previewFile.mimeType}</p>
                </div>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isImagePreview(previewFile.mimeType) && previewUrl && (
                <img src={previewUrl} alt={previewFile.name} className="max-w-full rounded-lg mx-auto" />
              )}
              {isImagePreview(previewFile.mimeType) && !previewUrl && (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading protected preview…</div>
              )}
              {!isImagePreview(previewFile.mimeType) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    {getFileIcon(previewFile.type, previewFile.mimeType)}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{previewFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Preview not available for this file type</p>
                  <div className="grid grid-cols-2 gap-3 text-left w-full max-w-sm">
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Type</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{previewFile.type}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Size</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatFileSize(previewFile.size)}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Category</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{previewFile.category.replace(/_/g, ' ')}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Version</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{previewFile.version}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Created</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{new Date(previewFile.createdAt).toLocaleDateString()}</p></div>
                    <div><p className="text-xs text-gray-400 dark:text-gray-500">Downloads</p><p className="text-sm font-medium text-gray-700 dark:text-gray-200">{previewFile.downloads}</p></div>
                  </div>
                  {previewFile.tags.length > 0 && (
                    <div className="mt-4 flex gap-1.5 flex-wrap justify-center">
                      {previewFile.tags.map(tag => (
                        <span key={tag} className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Backup status */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl dark:bg-gray-800/40">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Backup Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                    {previewFile.backup.primary ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-gray-400" />}
                    <span className="text-xs text-gray-600 dark:text-gray-300">Primary</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatVerifiedAt(previewFile.backup.primaryVerifiedAt)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                    {previewFile.backup.cloud ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-gray-400" />}
                    <span className="text-xs text-gray-600 dark:text-gray-300">Cloud</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatVerifiedAt(previewFile.backup.cloudVerifiedAt)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                    {previewFile.backup.external ? <CheckCircle size={14} className="text-green-500" /> : <AlertTriangle size={14} className="text-gray-400" />}
                    <span className="text-xs text-gray-600 dark:text-gray-300">External</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{formatVerifiedAt(previewFile.backup.externalVerifiedAt)}</p>
                  </div>
                </div>
                {previewFile.backup.checksum && (
                  <p className="text-[10px] text-gray-400 mt-3 font-mono break-all">SHA-256: {previewFile.backup.checksum}</p>
                )}
                {previewFile.backup.lastError && (
                  <p className="text-xs text-red-600 mt-3 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{previewFile.backup.lastError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex gap-2">
                <button onClick={() => handleBackup(previewFile._id, 'cloud')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
                  <Cloud size={13} /> {previewFile.backup.cloud ? 'Verify Cloud' : 'Backup to Cloud'}
                </button>
                <button onClick={() => handleBackup(previewFile._id, 'external')} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
                  <HardDrive size={13} /> {previewFile.backup.external ? 'Verify External' : 'Backup External'}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(previewFile)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5">
                  <Download size={13} /> Download
                </button>
                <button onClick={() => { if (previewFile) setDeleteTarget({ type: 'file', id: previewFile._id }); }} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-1.5 dark:bg-gray-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-500/10">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage stats modal */}
      {showStats && stats && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowStats(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 dark:bg-gray-900 dark:border dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Storage Overview</h3>
              <button onClick={() => setShowStats(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-xl p-4 text-center dark:bg-indigo-500/10">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.totalFiles}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Files</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center dark:bg-purple-500/10">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalFolders}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Folders</p>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 text-center dark:bg-cyan-500/10">
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatFileSize(stats.totalSize)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Total Size</p>
              </div>
            </div>
            {/* By type */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Files by Type</p>
              <div className="space-y-2">
                {stats.byType.map(t => (
                  <div key={t._id} className="flex items-center gap-3">
                    <div className="w-8 text-center">{getFileIcon(t._id, '')}</div>
                    <span className="text-sm text-gray-700 dark:text-gray-200 capitalize flex-1">{t._id}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.count}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 w-16 text-right">{formatFileSize(t.size)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Backup status */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Backup Status</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center dark:bg-green-500/10">
                  <CheckCircle size={18} className="text-green-500 mx-auto mb-1" />
                  <p className="text-sm font-bold text-green-700 dark:text-green-400">{stats.backup.primary}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Primary</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center dark:bg-blue-500/10">
                  <Cloud size={18} className="text-blue-500 mx-auto mb-1" />
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{stats.backup.cloud}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cloud</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center dark:bg-orange-500/10">
                  <HardDrive size={18} className="text-orange-500 mx-auto mb-1" />
                  <p className="text-sm font-bold text-orange-700 dark:text-orange-400">{stats.backup.external}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">External</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center dark:bg-emerald-500/10">
                  <CheckCircle size={18} className="text-emerald-600 mx-auto mb-1" />
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{stats.backup.healthy}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">3 Copies</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {(['cloud', 'external'] as const).map(target => {
                  const configuration = stats.backupConfiguration[target];
                  const ready = configuration.available;
                  return (
                    <div key={target} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700">
                      <span className="text-xs text-gray-600 dark:text-gray-300">{configuration.label}</span>
                      <span className={`text-xs font-semibold ${ready ? 'text-green-600' : 'text-amber-600'}`}>
                        {ready ? 'Available' : configuration.configured ? 'Drive unavailable' : 'Not configured'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'folder' ? 'Delete Folder' : 'Delete File'}
        message={deleteTarget?.type === 'folder'
          ? 'Are you sure you want to delete this folder and all its contents? This action cannot be undone.'
          : 'Are you sure you want to delete this file? This action cannot be undone.'}
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'folder') handleDeleteFolder(deleteTarget.id);
          else handleDeleteFile(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default FileManager;
