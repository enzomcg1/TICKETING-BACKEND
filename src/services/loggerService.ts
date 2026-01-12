import prisma from '../config/database';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogCategory = 'AUTH' | 'TICKET' | 'NOTIFICATION' | 'USER' | 'SYSTEM' | 'API' | 'DATABASE';

interface LogData {
  level: LogLevel;
  message: string;
  category: LogCategory;
  userId?: string;
  ticketId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

class LoggerService {
  async log(data: LogData): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level: data.level,
          message: data.message,
          category: data.category,
          userId: data.userId,
          ticketId: data.ticketId,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      // No lanzar error para evitar que el logging rompa la aplicación
      console.error('Error al guardar log:', error);
    }
  }

  async info(message: string, category: LogCategory, options?: Partial<LogData>): Promise<void> {
    return this.log({ level: 'INFO', message, category, ...options });
  }

  async warn(message: string, category: LogCategory, options?: Partial<LogData>): Promise<void> {
    return this.log({ level: 'WARN', message, category, ...options });
  }

  async error(message: string, category: LogCategory, options?: Partial<LogData>): Promise<void> {
    return this.log({ level: 'ERROR', message, category, ...options });
  }

  async debug(message: string, category: LogCategory, options?: Partial<LogData>): Promise<void> {
    return this.log({ level: 'DEBUG', message, category, ...options });
  }

  // Helper para extraer IP y UserAgent de un request
  extractRequestInfo(req: any): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    };
  }
}

export const loggerService = new LoggerService();






