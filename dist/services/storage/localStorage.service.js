"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class LocalStorageService {
    constructor(basePath = 'uploads') {
        this.basePath = path_1.default.join(process.cwd(), basePath);
    }
    async uploadFile(file, fileName, folder) {
        const folderPath = path_1.default.join(this.basePath, folder);
        await promises_1.default.mkdir(folderPath, { recursive: true });
        const filePath = path_1.default.join(folderPath, fileName);
        await promises_1.default.writeFile(filePath, file);
        return {
            url: `/uploads/${folder}/${fileName}`,
            path: `${folder}/${fileName}`
        };
    }
    async getFileUrl(filePath) {
        return `/uploads/${filePath}`;
    }
    async deleteFile(filePath) {
        const fullPath = path_1.default.join(this.basePath, filePath);
        try {
            await promises_1.default.unlink(fullPath);
        }
        catch (error) {
            // Si el archivo no existe, no es un error crítico
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async fileExists(filePath) {
        const fullPath = path_1.default.join(this.basePath, filePath);
        try {
            await promises_1.default.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LocalStorageService = LocalStorageService;
