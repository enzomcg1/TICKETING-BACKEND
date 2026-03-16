import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { IStorageService } from './storage.interface';

function getCloudinaryConfig() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const folder = (process.env.CLOUDINARY_FOLDER || 'ticketing').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary no configurado. Requiere CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  }

  return { cloudName, apiKey, apiSecret, folder };
}

export class CloudinaryStorageService implements IStorageService {
  private folder: string;

  constructor() {
    const config = getCloudinaryConfig();
    this.folder = config.folder;

    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async uploadFile(file: Buffer, fileName: string, folder: string): Promise<{ url: string; path: string }> {
    const publicId = `${this.folder}/${folder}/${fileName}`.replace(/^\/+|\/+$/g, '');

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'auto',
          overwrite: true,
          invalidate: true,
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error || new Error('Upload a Cloudinary fallido.'));
            return;
          }

          resolve(uploadResult);
        }
      );

      Readable.from(file).pipe(uploadStream);
    });

    return {
      url: result.secure_url,
      path: result.public_id,
    };
  }

  async getFileUrl(filePath: string): Promise<string> {
    const result = await cloudinary.api.resource(filePath, { resource_type: 'auto' });
    return result.secure_url;
  }

  async deleteFile(filePath: string): Promise<void> {
    const resourceTypes: Array<'image' | 'video' | 'raw'> = ['image', 'video', 'raw'];

    for (const resourceType of resourceTypes) {
      const result = await cloudinary.uploader.destroy(filePath, {
        resource_type: resourceType,
        invalidate: true,
      });

      if (result.result === 'ok') {
        return;
      }
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await cloudinary.api.resource(filePath, { resource_type: 'auto' });
      return true;
    } catch {
      return false;
    }
  }
}
