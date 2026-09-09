const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Folder = require('../models/Folder');
const File = require('../models/File');
const { backupFile: copyToBackup, checksumFile, getConfiguration } = require('../services/backupService');

const STORAGE_ROOT = path.resolve(__dirname, '..', 'uploads', 'files');

const ROOT_FOLDERS = [
  { name: 'Artists', icon: 'users', color: '#8B5CF6' },
  { name: 'Releases', icon: 'radio', color: '#06B6D4' },
  { name: 'Publishing', icon: 'file-text', color: '#10B981' },
  { name: 'Accounting', icon: 'dollar-sign', color: '#F59E0B' },
  { name: 'Legal', icon: 'shield', color: '#EF4444' },
  { name: 'Merchandise', icon: 'shopping-bag', color: '#EC4899' },
  { name: 'Templates', icon: 'layout', color: '#6366F1' },
];

const ARTIST_SUBFOLDERS = [
  { name: 'Music', icon: 'music', color: '#8B5CF6' },
  { name: 'Contracts', icon: 'file-text', color: '#EF4444' },
  { name: 'Photos', icon: 'camera', color: '#06B6D4' },
  { name: 'Videos', icon: 'video', color: '#EC4899' },
  { name: 'Marketing', icon: 'trending-up', color: '#10B981' },
  { name: 'Royalties', icon: 'star', color: '#F59E0B' },
];

const SONG_SUBFOLDERS = [
  { name: 'Recording Session', icon: 'mic', color: '#8B5CF6' },
  { name: 'Beat', icon: 'headphones', color: '#EC4899' },
  { name: 'Stems', icon: 'layers', color: '#06B6D4' },
  { name: 'Rough Mixes', icon: 'sliders', color: '#F59E0B' },
  { name: 'Final Masters', icon: 'award', color: '#10B981' },
  { name: 'Artwork', icon: 'image', color: '#EF4444' },
  { name: 'Lyrics', icon: 'pen-tool', color: '#6366F1' },
  { name: 'Split Sheet', icon: 'file-text', color: '#14B8A6' },
  { name: 'Producer Agreement', icon: 'file-check', color: '#F97316' },
  { name: 'Metadata Sheet', icon: 'database', color: '#64748B' },
  { name: 'Content Assets', icon: 'package', color: '#A855F7' },
];

const MIME_TYPE_MAP = {
  'image/jpeg': 'image', 'image/jpg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image', 'image/svg+xml': 'image',
  'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio', 'audio/flac': 'audio', 'audio/aac': 'audio', 'audio/mp4': 'audio',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/x-msvideo': 'video', 'video/webm': 'video',
  'application/pdf': 'document', 'application/msword': 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document', 'text/csv': 'document', 'application/vnd.ms-excel': 'document',
  'application/zip': 'archive', 'application/x-rar-compressed': 'archive', 'application/x-7z-compressed': 'archive',
};

const EXTENSION_TYPE_MAP = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image', '.svg': 'image',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio', '.aac': 'audio', '.m4a': 'audio', '.aiff': 'audio',
  '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.webm': 'video', '.mkv': 'video',
  '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document', '.csv': 'document', '.xls': 'document', '.xlsx': 'document',
  '.zip': 'archive', '.rar': 'archive', '.7z': 'archive', '.tar': 'archive', '.gz': 'archive',
};

const getFileType = (mimeType, fileName = '') => MIME_TYPE_MAP[mimeType] || EXTENSION_TYPE_MAP[path.extname(fileName).toLowerCase()] || 'other';

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const validateFolderName = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { error: 'Folder name is required' };
  if (trimmed === '.' || trimmed === '..' || /[<>:"/\\|?*\x00-\x1F]/.test(trimmed)) {
    return { error: 'Folder name contains unsupported characters' };
  }
  return { name: trimmed };
};

const resolveStoragePath = (folderPath = '/files') => {
  if (folderPath !== '/files' && !folderPath.startsWith('/files/')) throw new Error('Invalid storage folder path');
  const relative = folderPath.replace(/^\/files\/?/, '');
  const resolved = path.resolve(STORAGE_ROOT, ...relative.split('/').filter(Boolean));
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)) throw new Error('Storage path escapes the primary drive');
  return resolved;
};

const resolveFilePath = (publicPath) => {
  if (!publicPath?.startsWith('/uploads/files/')) throw new Error('Invalid managed file path');
  const relative = publicPath.slice('/uploads/files/'.length);
  const resolved = path.resolve(STORAGE_ROOT, ...relative.split('/').filter(Boolean));
  if (!resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)) throw new Error('Managed file path escapes the primary drive');
  return resolved;
};

const publicPathFor = (diskPath) => `/uploads/files/${path.relative(STORAGE_ROOT, diskPath).replace(/\\/g, '/')}`;
const backupRelativePath = (file) => file.path.slice('/uploads/files/'.length);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getFolderTree = async (folder) => {
  const descendants = await Folder.find({ path: { $regex: `^${escapeRegex(folder.path)}/` } }).sort('path');
  return [folder, ...descendants];
};

const moveIncomingFile = async (uploadedFile, folder) => {
  const targetDirectory = resolveStoragePath(folder?.path || '/files');
  await fs.promises.mkdir(targetDirectory, { recursive: true });
  const extension = path.extname(uploadedFile.originalname).toLowerCase();
  const safeBaseName = path.basename(uploadedFile.originalname, extension)
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'file';
  const targetPath = path.join(targetDirectory, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${extension}`);
  await fs.promises.rename(uploadedFile.path, targetPath);
  return targetPath;
};

const runBackup = async (file, target) => {
  const sourcePath = resolveFilePath(file.path);
  if (!fs.existsSync(sourcePath)) {
    file.backup.primary = false;
    file.backup.lastError = 'Primary file is missing';
    await file.save();
    throw new Error('Primary file is missing');
  }
  try {
    const result = await copyToBackup({ sourcePath, relativePath: backupRelativePath(file), target });
    file.backup[target] = true;
    file.backup[`${target}VerifiedAt`] = result.verifiedAt;
    file.backup.checksum = result.checksum;
    file.backup.lastBackupAt = result.verifiedAt;
    file.backup.lastError = '';
    await file.save();
    return result;
  } catch (error) {
    file.backup[target] = false;
    file.backup.lastError = error.message;
    await file.save();
    throw error;
  }
};

const runConfiguredBackups = async (file) => {
  const configuration = getConfiguration();
  for (const target of ['cloud', 'external']) {
    if (configuration[target].available) {
      try { await runBackup(file, target); } catch (_error) { /* Recorded on the file for retry. */ }
    }
  }
};

const storeUploadedFile = async (uploadedFile, metadata, userId) => {
  let folder = null;
  if (metadata.folderId) {
    folder = await Folder.findById(metadata.folderId);
    if (!folder) throw new Error('Destination folder not found');
  }
  const diskPath = await moveIncomingFile(uploadedFile, folder);
  try {
    const checksum = await checksumFile(diskPath);
    const file = await File.create({
      name: uploadedFile.originalname,
      originalName: uploadedFile.originalname,
      path: publicPathFor(diskPath),
      folderId: folder?._id || null,
      mimeType: uploadedFile.mimetype,
      size: uploadedFile.size,
      type: getFileType(uploadedFile.mimetype, uploadedFile.originalname),
      category: metadata.category || 'other',
      tags: metadata.tags,
      artistId: metadata.artistId || null,
      songId: metadata.songId || null,
      uploadedBy: userId,
      backup: { primary: true, checksum, primaryVerifiedAt: new Date() },
    });
    await runConfiguredBackups(file);
    return file;
  } catch (error) {
    await fs.promises.unlink(diskPath).catch(() => {});
    throw error;
  }
};

exports.initializeStorage = async (req, res) => {
  try {
    ensureDir(STORAGE_ROOT);
    const created = [];
    for (const rf of ROOT_FOLDERS) {
      let folder = await Folder.findOne({ name: rf.name, parentId: null });
      if (!folder) {
        folder = await Folder.create({
          name: rf.name, parentId: null, path: `/files/${rf.name}`,
          icon: rf.icon, color: rf.color, createdBy: req.user._id,
        });
        created.push(folder);
      }
      ensureDir(resolveStoragePath(folder.path));
    }
    const roots = await Folder.find({ parentId: null }).sort('name');
    res.status(created.length ? 201 : 200).json({
      success: true,
      message: created.length ? `Created ${created.length} missing root folder(s)` : 'Storage already initialized',
      data: roots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRootFolders = async (req, res) => {
  try {
    const folders = await Folder.find({ parentId: null }).sort('name').populate('createdBy', 'name');
    const fileCount = await File.countDocuments({ folderId: null });
    res.json({ success: true, data: { folders, fileCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFolderContents = async (req, res) => {
  try {
    const { folderId } = req.params;
    const [folders, files, folder] = await Promise.all([
      Folder.find({ parentId: folderId }).sort('name'),
      File.find({ folderId }).sort('-createdAt'),
      Folder.findById(folderId),
    ]);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
    const breadcrumbs = [];
    let current = folder;
    while (current) {
      breadcrumbs.unshift({ _id: current._id, name: current.name });
      current = current.parentId ? await Folder.findById(current.parentId) : null;
    }
    res.json({ success: true, data: { folder, folders, files, breadcrumbs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const validated = validateFolderName(name);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    let parentPath = '/files';
    if (parentId) {
      const parent = await Folder.findById(parentId);
      if (!parent) return res.status(404).json({ success: false, message: 'Parent folder not found' });
      parentPath = parent.path;
    }
    const duplicate = await Folder.findOne({ name: validated.name, parentId: parentId || null });
    if (duplicate) return res.status(409).json({ success: false, message: 'A folder with that name already exists here' });
    const folderPath = `${parentPath}/${validated.name}`;
    ensureDir(resolveStoragePath(folderPath));
    const folder = await Folder.create({
      name: validated.name, parentId: parentId || null, path: folderPath,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createArtistStructure = async (req, res) => {
  try {
    const { artistName, artistId } = req.body;
    const validated = validateFolderName(artistName);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error.replace('Folder', 'Artist') });
    const artistsFolder = await Folder.findOne({ name: 'Artists', parentId: null });
    if (!artistsFolder) return res.status(400).json({ success: false, message: 'Artists root folder not found' });
    const existing = await Folder.findOne({ name: validated.name, parentId: artistsFolder._id });
    if (existing) return res.status(409).json({ success: false, message: 'This artist folder already exists' });
    const artistFolder = await Folder.create({
      name: validated.name, parentId: artistsFolder._id,
      path: `${artistsFolder.path}/${validated.name}`, icon: 'user', color: '#8B5CF6',
      createdBy: req.user._id,
    });
    ensureDir(resolveStoragePath(artistFolder.path));
    const created = [artistFolder];
    for (const sf of ARTIST_SUBFOLDERS) {
      const sub = await Folder.create({
        name: sf.name, parentId: artistFolder._id,
        path: `${artistFolder.path}/${sf.name}`,
        icon: sf.icon, color: sf.color, createdBy: req.user._id,
      });
      ensureDir(resolveStoragePath(sub.path));
      created.push(sub);
    }
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSongStructure = async (req, res) => {
  try {
    const { songName, parentFolderId } = req.body;
    const validated = validateFolderName(songName);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error.replace('Folder', 'Song') });
    if (!parentFolderId) return res.status(400).json({ success: false, message: 'Open an artist Music folder before creating a song structure' });
    const parentFolder = await Folder.findById(parentFolderId);
    if (!parentFolder) return res.status(404).json({ success: false, message: 'Parent folder not found' });
    if (parentFolder.name !== 'Music' || !parentFolder.parentId) {
      return res.status(400).json({ success: false, message: 'Song structures can only be created inside an artist Music folder' });
    }
    const existing = await Folder.findOne({ name: validated.name, parentId: parentFolder._id });
    if (existing) return res.status(409).json({ success: false, message: 'This song folder already exists here' });
    const songFolder = await Folder.create({
      name: validated.name, parentId: parentFolder._id,
      path: `${parentFolder.path}/${validated.name}`, icon: 'music', color: '#8B5CF6',
      createdBy: req.user._id,
    });
    ensureDir(resolveStoragePath(songFolder.path));
    const created = [songFolder];
    for (const sf of SONG_SUBFOLDERS) {
      const sub = await Folder.create({
        name: sf.name, parentId: songFolder._id,
        path: `${songFolder.path}/${sf.name}`,
        icon: sf.icon, color: sf.color, createdBy: req.user._id,
      });
      ensureDir(resolveStoragePath(sub.path));
      created.push(sub);
    }
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });

    const validated = validateFolderName(name);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    if (validated.name === folder.name) return res.json({ success: true, data: folder });

    const duplicate = await Folder.findOne({
      _id: { $ne: folder._id },
      parentId: folder.parentId || null,
      name: validated.name,
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'A folder with this name already exists here' });

    const oldFolderPath = folder.path;
    const pathSegments = oldFolderPath.split('/');
    pathSegments[pathSegments.length - 1] = validated.name;
    const newFolderPath = pathSegments.join('/');
    const oldDiskPath = resolveStoragePath(oldFolderPath);
    const newDiskPath = resolveStoragePath(newFolderPath);
    if (fs.existsSync(newDiskPath)) return res.status(409).json({ success: false, message: 'A physical folder with this name already exists here' });
    if (fs.existsSync(oldDiskPath)) await fs.promises.rename(oldDiskPath, newDiskPath);

    const folderTree = await getFolderTree(folder);
    const folderIds = folderTree.map(item => item._id);
    const files = await File.find({ folderId: { $in: folderIds } });

    folder.name = validated.name;
    folder.path = newFolderPath;
    await folder.save();

    for (const descendant of folderTree.slice(1)) {
      descendant.path = `${newFolderPath}${descendant.path.slice(oldFolderPath.length)}`;
      await descendant.save();
    }

    for (const file of files) {
      const oldPublicPrefix = `/uploads${oldFolderPath}/`;
      if (file.path.startsWith(oldPublicPrefix)) {
        file.path = `/uploads${newFolderPath}/${file.path.slice(oldPublicPrefix.length)}`;
      }
      file.backup.cloud = false;
      file.backup.external = false;
      file.backup.cloudVerifiedAt = undefined;
      file.backup.externalVerifiedAt = undefined;
      file.backup.lastError = 'Backups require refresh after renaming the primary folder';
      await file.save();
      await runConfiguredBackups(file);
    }

    res.json({ success: true, data: folder, updatedFiles: files.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
    const folderTree = await getFolderTree(folder);
    const folderIds = folderTree.map(item => item._id);
    const physicalPath = resolveStoragePath(folder.path);
    if (fs.existsSync(physicalPath)) await fs.promises.rm(physicalPath, { recursive: true, force: false });
    const deletedFiles = await File.deleteMany({ folderId: { $in: folderIds } });
    await Folder.deleteMany({ _id: { $in: folderIds } });
    res.json({
      success: true,
      message: 'Folder and its primary files deleted',
      deletedFolders: folderIds.length,
      deletedFiles: deletedFiles.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    const { folderId, artistId, songId, category, tags } = req.body;
    const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];
    const file = await storeUploadedFile(req.file, { folderId, artistId, songId, category, tags: parsedTags }, req.user._id);
    res.status(201).json({ success: true, data: file });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) await fs.promises.unlink(req.file.path).catch(() => {});
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'No files provided' });
    const { folderId, artistId, songId, category, tags } = req.body;
    const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];
    const files = [];
    for (const f of req.files) {
      const file = await storeUploadedFile(f, { folderId, artistId, songId, category, tags: parsedTags }, req.user._id);
      files.push(file);
    }
    res.status(201).json({ success: true, data: files });
  } catch (error) {
    for (const uploaded of req.files || []) {
      if (uploaded.path && fs.existsSync(uploaded.path)) await fs.promises.unlink(uploaded.path).catch(() => {});
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFiles = async (req, res) => {
  try {
    const { folderId, artistId, songId, category, type, search, starred, page = 1, limit = 50 } = req.query;
    const query = {};
    if (folderId) query.folderId = folderId;
    if (artistId) query.artistId = artistId;
    if (songId) query.songId = songId;
    if (category) query.category = category;
    if (type) query.type = type;
    if (starred === 'true') query.starred = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }
    const files = await File.find(query)
      .populate('uploadedBy', 'name')
      .populate('artistId', 'name artistName stageName')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await File.countDocuments(query);
    res.json({ success: true, data: files, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .populate('uploadedBy', 'name')
      .populate('artistId', 'name artistName stageName')
      .populate('songId', 'title');
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFile = async (req, res) => {
  try {
    const allowed = ['name', 'category', 'tags', 'artistId', 'songId', 'versionNote'];
    const updates = allowed.reduce((result, field) => {
      if (req.body[field] !== undefined) result[field] = req.body[field];
      return result;
    }, {});
    const file = await File.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleStar = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    file.starred = !file.starred;
    await file.save();
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moveFile = async (req, res) => {
  try {
    const { folderId } = req.body;
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    const destinationFolder = folderId ? await Folder.findById(folderId) : null;
    if (folderId && !destinationFolder) return res.status(404).json({ success: false, message: 'Destination folder not found' });
    const sourcePath = resolveFilePath(file.path);
    if (!fs.existsSync(sourcePath)) return res.status(409).json({ success: false, message: 'Primary file is missing' });
    const destinationDirectory = resolveStoragePath(destinationFolder?.path || '/files');
    await fs.promises.mkdir(destinationDirectory, { recursive: true });
    const destinationPath = path.join(destinationDirectory, path.basename(sourcePath));
    if (sourcePath !== destinationPath) await fs.promises.rename(sourcePath, destinationPath);
    file.folderId = destinationFolder?._id || null;
    file.path = publicPathFor(destinationPath);
    file.backup.cloud = false;
    file.backup.external = false;
    file.backup.cloudVerifiedAt = undefined;
    file.backup.externalVerifiedAt = undefined;
    file.backup.lastError = 'Backups require refresh after moving the primary file';
    await file.save();
    await runConfiguredBackups(file);
    res.json({ success: true, data: file });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    const fullPath = resolveFilePath(file.path);
    if (fs.existsSync(fullPath)) await fs.promises.unlink(fullPath);
    await file.deleteOne();
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.backupFile = async (req, res) => {
  try {
    const { target } = req.body;
    if (!['cloud', 'external'].includes(target)) return res.status(400).json({ success: false, message: 'Backup target must be cloud or external' });
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    const verification = await runBackup(file, target);
    res.json({ success: true, data: file, verification });
  } catch (error) {
    const status = ['BACKUP_NOT_CONFIGURED', 'BACKUP_UNAVAILABLE'].includes(error.code) ? 503 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

exports.searchFiles = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const files = await File.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ],
    }).populate('uploadedBy', 'name').populate('artistId', 'name artistName').sort('-createdAt').limit(50);
    const folders = await Folder.find({ name: { $regex: q, $options: 'i' } }).limit(20);
    res.json({ success: true, data: { files, folders } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStorageStats = async (req, res) => {
  try {
    const [totalFiles, totalFolders, totalSize, byType, byCategory, backedUp] = await Promise.all([
      File.countDocuments(),
      Folder.countDocuments(),
      File.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
      File.aggregate([{ $group: { _id: '$type', count: { $sum: 1 }, size: { $sum: '$size' } } }]),
      File.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      File.aggregate([{
        $group: {
          _id: null,
          primary: { $sum: { $cond: ['$backup.primary', 1, 0] } },
          cloud: { $sum: { $cond: ['$backup.cloud', 1, 0] } },
          external: { $sum: { $cond: ['$backup.external', 1, 0] } },
          healthy: { $sum: { $cond: [{ $and: ['$backup.primary', '$backup.cloud', '$backup.external'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      }]),
    ]);
    res.json({
      success: true,
      data: {
        totalFiles,
        totalFolders,
        totalSize: totalSize[0]?.total || 0,
        byType,
        byCategory,
        backup: backedUp[0] || { primary: 0, cloud: 0, external: 0, healthy: 0, total: 0 },
        backupConfiguration: getConfiguration(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
