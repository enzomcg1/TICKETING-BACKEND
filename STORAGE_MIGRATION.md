# Estrategia de Migración a Almacenamiento en la Nube

## 📋 Resumen

Esta guía explica cómo el sistema está diseñado para funcionar tanto con almacenamiento local como en la nube, y cómo realizar la migración de datos cuando sea necesario.

## 🏗️ Arquitectura de Almacenamiento

### Diseño: Patrón de Abstracción (Storage Adapter)

Utilizamos un **patrón de adaptador** que permite cambiar entre diferentes proveedores de almacenamiento sin modificar la lógica de negocio:

```
┌─────────────────────────────────────┐
│   Lógica de Negocio (Attachments)   │
│   - Crear adjunto                   │
│   - Obtener adjunto                 │
│   - Eliminar adjunto                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Storage Service (Abstracción)     │
│   - uploadFile()                    │
│   - getFileUrl()                    │
│   - deleteFile()                    │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌──────────────┐  ┌──────────────┐
│ Local Storage│  │ Cloud Storage│
│ (fs)         │  │ (S3/Cloud)   │
└──────────────┘  └──────────────┘
```

## 🔄 Comparación: Local vs Nube

| Aspecto | Local (Actual) | Nube (Futuro) |
|---------|----------------|---------------|
| **Almacenamiento** | `backend/uploads/` | AWS S3 / Cloudinary / Azure Blob |
| **URLs** | `/uploads/tickets/...` | `https://s3.amazonaws.com/...` |
| **Escalabilidad** | Limitada por servidor | Ilimitada |
| **Backup** | Manual | Automático |
| **Costo** | Solo servidor | Pay-per-use |
| **Velocidad** | Muy rápida (LAN) | Rápida (CDN) |
| **Disponibilidad** | Depende del servidor | 99.99%+ |

## 🎯 Implementación: Storage Adapter

### Estructura de Archivos

```
backend/src/
├── services/
│   ├── storage/
│   │   ├── storage.interface.ts      # Interfaz común
│   │   ├── localStorage.service.ts   # Implementación local
│   │   ├── s3Storage.service.ts      # Implementación AWS S3
│   │   ├── cloudinaryStorage.service.ts  # Implementación Cloudinary
│   │   └── storageFactory.ts         # Factory para seleccionar proveedor
```

### 1. Interfaz de Almacenamiento

```typescript
// storage.interface.ts
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
```

### 2. Implementación Local (Actual)

```typescript
// localStorage.service.ts
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
    await fs.unlink(fullPath);
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
```

### 3. Implementación AWS S3 (Futuro)

```typescript
// s3Storage.service.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from './storage.interface';

export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET!;
  }

  async uploadFile(
    file: Buffer,
    fileName: string,
    folder: string
  ): Promise<{ url: string; path: string }> {
    const key = `${folder}/${fileName}`;
    
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: this.getContentType(fileName),
      })
    );

    return {
      url: `https://${this.bucketName}.s3.amazonaws.com/${key}`,
      path: key
    };
  }

  async getFileUrl(key: string): Promise<string> {
    // Generar URL firmada (válida por 1 hora)
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    
    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      })
    );
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return types[ext || ''] || 'application/octet-stream';
  }
}
```

### 4. Factory para Seleccionar Proveedor

```typescript
// storageFactory.ts
import { IStorageService } from './storage.interface';
import { LocalStorageService } from './localStorage.service';
import { S3StorageService } from './s3Storage.service';

export function getStorageService(): IStorageService {
  const storageType = process.env.STORAGE_TYPE || 'local';

  switch (storageType) {
    case 's3':
      return new S3StorageService();
    case 'local':
    default:
      return new LocalStorageService();
  }
}
```

## 📦 Variables de Entorno

### `.env` (Local)
```env
STORAGE_TYPE=local
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760  # 10MB
```

### `.env` (Nube - AWS S3)
```env
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_S3_BUCKET=tu-bucket-name
MAX_FILE_SIZE=10485760  # 10MB
```

## 🔄 Proceso de Migración

### Paso 1: Preparar el Código (Ahora)

1. **Implementar Storage Adapter** (abstracción)
2. **Usar la abstracción** en el servicio de attachments
3. **Configurar variables de entorno** para cambiar proveedor

### Paso 2: Migración de Datos (Cuando se necesite)

#### Opción A: Script de Migración Manual

```typescript
// scripts/migrateToS3.ts
import { LocalStorageService } from '../src/services/storage/localStorage.service';
import { S3StorageService } from '../src/services/storage/s3Storage.service';
import prisma from '../src/config/database';

async function migrateAttachments() {
  const localStorage = new LocalStorageService();
  const s3Storage = new S3StorageService();

  // Obtener todos los attachments
  const attachments = await prisma.attachment.findMany({
    where: {
      filePath: { startsWith: 'tickets/' } // Solo archivos locales
    }
  });

  console.log(`Migrando ${attachments.length} archivos...`);

  for (const attachment of attachments) {
    try {
      // Leer archivo local
      const fileBuffer = await fs.readFile(
        path.join(process.cwd(), 'uploads', attachment.filePath)
      );

      // Subir a S3
      const { url, path: newPath } = await s3Storage.uploadFile(
        fileBuffer,
        attachment.fileName,
        'tickets'
      );

      // Actualizar en BD
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          filePath: newPath,
          fileUrl: url
        }
      });

      console.log(`✅ Migrado: ${attachment.fileName}`);
    } catch (error) {
      console.error(`❌ Error migrando ${attachment.fileName}:`, error);
    }
  }

  console.log('Migración completada');
}

migrateAttachments();
```

#### Opción B: Migración Automática (Lazy Migration)

Los archivos se migran automáticamente cuando se acceden por primera vez:

```typescript
// En el servicio de attachments
async getAttachmentUrl(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId }
  });

  if (!attachment) throw new Error('Attachment not found');

  // Si está en local pero el storage es S3, migrar
  if (process.env.STORAGE_TYPE === 's3' && attachment.filePath.startsWith('tickets/')) {
    await this.migrateToS3(attachment);
    // Recargar attachment actualizado
    attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  }

  return attachment.fileUrl;
}
```

## 🚀 Ventajas de este Diseño

### ✅ **Sin Cambios en la Lógica de Negocio**
- El código de attachments no cambia al migrar
- Solo cambia la implementación del storage

### ✅ **Migración Gradual**
- Puedes migrar archivos de forma incremental
- No necesitas downtime

### ✅ **Flexibilidad**
- Fácil cambiar entre proveedores
- Puedes usar diferentes proveedores en dev/prod

### ✅ **Testing**
- Fácil hacer mocks del storage service
- Puedes probar con storage local en desarrollo

## 📊 Proveedores Recomendados

### 1. **AWS S3** (Recomendado para empresas)
- **Ventajas**: Escalable, confiable, integración con AWS
- **Costo**: ~$0.023/GB/mes
- **Ideal para**: Empresas que ya usan AWS

### 2. **Cloudinary** (Recomendado para imágenes/videos)
- **Ventajas**: Optimización automática, transformaciones, CDN
- **Costo**: Plan gratuito generoso, luego ~$0.10/GB
- **Ideal para**: Sistemas con muchas imágenes/videos

### 3. **Azure Blob Storage**
- **Ventajas**: Integración con Azure, buena para empresas Microsoft
- **Costo**: ~$0.018/GB/mes
- **Ideal para**: Empresas que usan Azure

### 4. **Google Cloud Storage**
- **Ventajas**: Integración con GCP, buena para empresas Google
- **Costo**: ~$0.020/GB/mes
- **Ideal para**: Empresas que usan GCP

## 🔐 Seguridad en la Nube

### URLs Públicas vs Privadas

**Públicas** (Recomendado para imágenes/videos):
- URLs directas accesibles
- Mejor rendimiento (CDN)
- Costo más bajo

**Privadas** (Recomendado para documentos):
- URLs firmadas con expiración
- Control de acceso
- Más seguro pero más costoso

### Implementación de URLs Privadas

```typescript
// En el servicio de attachments
async getAttachmentUrl(attachmentId: string, userId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: true }
  });

  // Verificar permisos
  if (!canUserAccessTicket(userId, attachment.ticket)) {
    throw new Error('No autorizado');
  }

  // Generar URL firmada (válida por 1 hora)
  return await storageService.getFileUrl(attachment.filePath);
}
```

## 📝 Checklist de Migración

### Antes de Migrar
- [ ] Implementar Storage Adapter
- [ ] Configurar cuenta en proveedor de nube
- [ ] Configurar variables de entorno
- [ ] Probar con archivos de prueba
- [ ] Hacer backup de archivos locales

### Durante la Migración
- [ ] Ejecutar script de migración
- [ ] Verificar que todos los archivos se migraron
- [ ] Actualizar URLs en base de datos
- [ ] Probar acceso a archivos migrados

### Después de Migrar
- [ ] Cambiar `STORAGE_TYPE=s3` en producción
- [ ] Monitorear costos de almacenamiento
- [ ] Configurar backups automáticos
- [ ] Documentar proceso de migración

## 🎯 Conclusión

**Sí, funcionará igual en la nube.** El diseño con Storage Adapter garantiza que:
1. ✅ La lógica de negocio no cambia
2. ✅ La migración es transparente para el usuario
3. ✅ Puedes migrar gradualmente sin downtime
4. ✅ Es fácil cambiar entre proveedores

**Próximos pasos:**
1. Implementar Storage Adapter en la creación de adjuntos
2. Usar storage local inicialmente
3. Cuando necesites migrar, solo cambia `STORAGE_TYPE=s3` y ejecuta el script de migración

