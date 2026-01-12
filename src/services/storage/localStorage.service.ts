import fs from 'fs/promises';
import path from 'path';
import { IStorageService } from './storage.interface';

export class LocalStorageService implements IStorageService {
  private basePath: string;

  constructor(basePath: string = 'uploads') {
    this.basePath = path.join(process.cwd(), basePath);
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    folder: string
  ): Promise<{ url: string; path: string }> {
    const folderPath = path.join(this.basePath, folder);
    await fs.mkdir(folderPath, { recursive: true });
    
    const filePath = path.join(folderPath, fileName);
    await fs.writeFile(filePath, file);
    
    return {
      url: `/uploads/${folder}/${fileName}`,
      path: `${folder}/${fileName}`
    };
  }

  async getFileUrl(filePath: string): Promise<string> {
    return `/uploads/${filePath}`;
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      // Si el archivo no existe, no es un error crítico
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

