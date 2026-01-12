"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggerService = void 0;
const database_1 = __importDefault(require("../config/database"));
class LoggerService {
    async log(data) {
        try {
            await database_1.default.systemLog.create({
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
        }
        catch (error) {
            // No lanzar error para evitar que el logging rompa la aplicación
            console.error('Error al guardar log:', error);
        }
    }
    async info(message, category, options) {
        return this.log({ level: 'INFO', message, category, ...options });
    }
    async warn(message, category, options) {
        return this.log({ level: 'WARN', message, category, ...options });
    }
    async error(message, category, options) {
        return this.log({ level: 'ERROR', message, category, ...options });
    }
    async debug(message, category, options) {
        return this.log({ level: 'DEBUG', message, category, ...options });
    }
    // Helper para extraer IP y UserAgent de un request
    extractRequestInfo(req) {
        return {
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || undefined,
            userAgent: req.headers['user-agent'] || undefined,
        };
    }
}
exports.loggerService = new LoggerService();
