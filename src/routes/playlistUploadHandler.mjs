import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { appConfig } from '../config/appConfig.mjs';
// Importar el VLCPlayer para controlar la reproducción
import { VLCPlayer } from '../lib/vlcPlayer.js';

const router = express.Router();

// Crear una instancia del reproductor VLC (o utilizar una existente)
let vlcPlayerInstance = null;

// Función para obtener o crear la instancia del VLCPlayer
function getVLCPlayerInstance() {
    if (!vlcPlayerInstance) {
        vlcPlayerInstance = new VLCPlayer();
    }
    return vlcPlayerInstance;
}

// Variables para el control de la playlist
let IndexCountFilesInDirPlaylist = 0;
let countPlaylistItems = 0;
let activePlaylistName = null;
let playlistDirName = null;
let playlistDirPath = null;
let currentPlaylistDirPath = null;
let newPlaylistM3uPath = null;
let previewPlaylistDirPath = null;

// Configuración de multer para el manejo de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Mantener el nombre original del archivo
        cb(null, file.originalname);
    }
});
// Configuración de multer

const upload = multer({
    storage: storage,
    limits: {
        fileSize: appConfig.security.maxFileSize
    }
});

/**
 * @swagger
 * /api/playlist/upload:
 *   post:
 *     summary: Sube un archivo y lo agrega a una playlist
 *     parameters:
 *       - name: file
 *         in: formData
 *         required: true
 *         type: file
 *       - name: playlistName
 *         in: formData
 *         required: false
 *         type: string
 *       - name: countPlaylistItems
 *         in: formData
 *         required: false
 *         type: number
 */
router.post('/upload', upload.array('file'), async (req, res) => {
    const files = req.files;
    const playlistNameFromRequest = req.body.playlistName || `playlist_${Date.now()}`;
    countPlaylistItems = parseInt(req.body.countPlaylistItems, 10) || files.length;

    if (!files || files.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No se ha proporcionado ningún archivo'
        });
    }

    try {
        // Inicializar la playlist si es el primer archivo
        if (IndexCountFilesInDirPlaylist === 0 || !activePlaylistName) {
            activePlaylistName = playlistNameFromRequest.endsWith('.m3u')
                ? playlistNameFromRequest
                : `${playlistNameFromRequest}.m3u`;

            playlistDirName = activePlaylistName.replace('.m3u', '');
            playlistDirPath = path.join(appConfig.paths.videos, playlistDirName);

            previewPlaylistDirPath = currentPlaylistDirPath;
            currentPlaylistDirPath = playlistDirPath;

            // Crear directorio si no existe
            await fsPromises.mkdir(playlistDirPath, { recursive: true });
        }

        for (const file of files) {
            // Mover cada archivo a su ubicación final
            const newFileMP4Path = path.join(playlistDirPath, file.originalname);
            await fsPromises.rename(file.path, newFileMP4Path);

            // Actualizar o crear la playlist
            newPlaylistM3uPath = path.join(playlistDirPath, activePlaylistName);
            console.log("🚀 ~ router.post ~ newPlaylistM3uPath:", newPlaylistM3uPath)
            const MP4fullPath = path.join('/home/tecno/app-player', newFileMP4Path);
            console.log("🚀 ~ router.post ~ fullPath:", MP4fullPath)
            if (IndexCountFilesInDirPlaylist === 0) {
                await fsPromises.writeFile(newPlaylistM3uPath, `#EXTM3U\n${MP4fullPath}\n`);
            } else {
                await fsPromises.appendFile(newPlaylistM3uPath, `${MP4fullPath}\n`);
            }

            // Incrementar el contador de archivos
            IndexCountFilesInDirPlaylist++;
        }

        // Verificar si es el último archivo de la playlist
        if (IndexCountFilesInDirPlaylist === countPlaylistItems) {
            // Resetear contadores
            IndexCountFilesInDirPlaylist = 0;
            activePlaylistName = null;

            return res.json({
                success: true,
                message: 'Playlist procesada correctamente',
                playlist: {
                    name: playlistDirName,
                    path: newPlaylistM3uPath,
                    totalFiles: countPlaylistItems
                }
            });
        }

    } catch (error) {
        console.error('Error en el procesamiento de los archivos:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar los archivos',
            error: error.message
        });
    }
});

// Función para limpiar directorios antiguos (modificada para excluir el directorio actual y el anterior)
async function cleanupOldDirectories(currentDirName) {
    try {
        const dirs = await fsPromises.readdir(appConfig.paths.videos);
        for (const dir of dirs) {
            const dirPath = path.join(appConfig.paths.videos, dir);
            const stats = await fsPromises.stat(dirPath);
            if (stats.isDirectory() && dir !== currentDirName && dirPath !== previewPlaylistDirPath) {
                await fsPromises.rm(dirPath, { recursive: true, force: true });
                console.log(`Directorio antiguo eliminado: ${dirPath}`);
            }
        }
    } catch (error) {
        console.error('Error al limpiar directorios antiguos:', error);
        throw error;
    }
}

// Manejo de errores de multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: 'Error en la subida del archivo',
            error: error.message
        });
    }
    next(error);
});

export default router; 