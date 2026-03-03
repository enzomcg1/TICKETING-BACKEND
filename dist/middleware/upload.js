"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
exports.generateFileName = generateFileName;
exports.getFileExtension = getFileExtension;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES];
const MIME_TO_EXTENSIONS = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/jpg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/quicktime': ['.mov'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    const extension = path_1.default.extname(file.originalname).toLowerCase();
    const validExtensions = MIME_TO_EXTENSIONS[file.mimetype] || [];
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) && validExtensions.includes(extension)) {
        cb(null, true);
    }
    else {
        cb(new Error('Tipo de archivo no permitido o extension invalida'));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5,
    },
});
function generateFileName(originalName) {
    const ext = path_1.default.extname(originalName).toLowerCase();
    const baseName = path_1.default.basename(originalName, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 120) || 'file';
    const timestamp = Date.now();
    const uuid = (0, uuid_1.v4)().split('-')[0];
    return `${sanitizedBaseName}_${timestamp}_${uuid}${ext}`;
}
function getFileExtension(mimeType) {
    const mimeToExt = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return mimeToExt[mimeType] || '';
}
