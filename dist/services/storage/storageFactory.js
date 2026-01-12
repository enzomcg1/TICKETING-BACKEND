"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageService = getStorageService;
const localStorage_service_1 = require("./localStorage.service");
function getStorageService() {
    const storageType = process.env.STORAGE_TYPE || 'local';
    switch (storageType) {
        case 'local':
        default:
            return new localStorage_service_1.LocalStorageService(process.env.UPLOAD_DIR || 'uploads');
        // Aquí se pueden agregar más proveedores en el futuro (S3, Cloudinary, etc.)
        // case 's3':
        //   return new S3StorageService();
        // case 'cloudinary':
        //   return new CloudinaryStorageService();
    }
}
