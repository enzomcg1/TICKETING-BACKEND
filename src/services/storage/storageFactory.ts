import { IStorageService } from './storage.interface';
import { LocalStorageService } from './localStorage.service';

export function getStorageService(): IStorageService {
  const storageType = process.env.STORAGE_TYPE || 'local';

  switch (storageType) {
    case 'local':
    default:
      return new LocalStorageService(process.env.UPLOAD_DIR || 'uploads');
    // Aquí se pueden agregar más proveedores en el futuro (S3, Cloudinary, etc.)
    // case 's3':
    //   return new S3StorageService();
    // case 'cloudinary':
    //   return new CloudinaryStorageService();
  }
}

