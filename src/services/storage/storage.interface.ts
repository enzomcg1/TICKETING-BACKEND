// Interfaz común para servicios de almacenamiento
export interface IStorageService {
  uploadFile(
    file: Buffer,
    fileName: string,
    folder: string
  ): Promise<{ url: string; path: string }>;
  
  getFileUrl(path: string): Promise<string>;
  
  deleteFile(path: string): Promise<void>;
  
  fileExists(path: string): Promise<boolean>;
}

