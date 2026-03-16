import { CloudinaryStorageService } from './cloudinaryStorage.service';
import { IStorageService } from './storage.interface';
import { LocalStorageService } from './localStorage.service';

export function getStorageService(): IStorageService {
  const storageType = (process.env.STORAGE_TYPE || 'local').trim().toLowerCase();

  switch (storageType) {
    case 'cloudinary':
      return new CloudinaryStorageService();
    case 'local':
      return new LocalStorageService(process.env.UPLOAD_DIR || 'uploads');
    default:
      throw new Error(`STORAGE_TYPE no soportado: ${storageType}`);
  }
}
