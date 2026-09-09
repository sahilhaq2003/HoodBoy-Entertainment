const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/fileManagerUpload');
const {
  initializeStorage, getRootFolders, getFolderContents,
  createFolder, createArtistStructure, createSongStructure,
  renameFolder, deleteFolder,
  uploadFile, uploadMultipleFiles, getFiles, getFile,
  updateFile, toggleStar, moveFile, deleteFile,
  backupFile, searchFiles, getStorageStats,
} = require('../controllers/fileManagerController');

router.use(protect);

router.post('/initialize', checkPermission('files', 'write'), initializeStorage);
router.get('/stats', checkPermission('files', 'read'), getStorageStats);
router.get('/search', checkPermission('files', 'read'), searchFiles);
router.get('/root', checkPermission('files', 'read'), getRootFolders);
router.get('/folder/:folderId', checkPermission('files', 'read'), getFolderContents);

router.post('/folders', checkPermission('files', 'write'), createFolder);
router.post('/folders/artist-structure', checkPermission('files', 'write'), createArtistStructure);
router.post('/folders/song-structure', checkPermission('files', 'write'), createSongStructure);
router.put('/folders/:id', checkPermission('files', 'write'), renameFolder);
router.delete('/folders/:id', checkPermission('files', 'write'), deleteFolder);

router.post('/upload', checkPermission('files', 'write'), upload.single('file'), uploadFile);
router.post('/upload-multiple', checkPermission('files', 'write'), upload.array('files', 20), uploadMultipleFiles);
router.get('/files', checkPermission('files', 'read'), getFiles);
router.get('/files/:id', checkPermission('files', 'read'), getFile);
router.put('/files/:id', checkPermission('files', 'write'), updateFile);
router.patch('/files/:id/star', checkPermission('files', 'write'), toggleStar);
router.put('/files/:id/move', checkPermission('files', 'write'), moveFile);
router.delete('/files/:id', checkPermission('files', 'write'), deleteFile);

router.post('/files/:id/backup', checkPermission('files', 'write'), backupFile);

module.exports = router;
