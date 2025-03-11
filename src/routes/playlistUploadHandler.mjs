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
let activePlaylistName = null;
let playlistDirName = null;
let playlistDirPath = null;
let currentPlaylistDirPath = null;
let previewPlaylistDirPath = null;
let countPlaylistItems = 0;

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
router.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const playlistNameFromRequest = req.body.playlistName || `playlist_${Date.now()}`;
    countPlaylistItems = parseInt(req.body.countPlaylistItems, 10) || 1;

    if (!file) {
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

        // Mover el archivo a su ubicación final
        const newFileMP4Path = path.join(playlistDirPath, file.originalname);
        await fsPromises.rename(file.path, newFileMP4Path);

        // Actualizar o crear la playlist
        const newPlaylistM3uPath = path.join(playlistDirPath, activePlaylistName);
        if (IndexCountFilesInDirPlaylist === 0) {
            // Usar la ruta completa para el archivo en la playlist
            const fullPath = path.join('/home/tecno/app-player', newFileMP4Path);
            await fsPromises.writeFile(newPlaylistM3uPath, `#EXTM3U\n${fullPath}\n`);
        } else {
            // Usar la ruta completa para el archivo en la playlist
            const fullPath = path.join('/home/tecno/app-player', newFileMP4Path);
            await fsPromises.appendFile(newPlaylistM3uPath, `${fullPath}\n`);
        }

        // Incrementar el contador de archivos
        IndexCountFilesInDirPlaylist++;

        // Verificar si es el último archivo de la playlist
        if (IndexCountFilesInDirPlaylist === countPlaylistItems) {
            // Reiniciar la reproducción con la nueva playlist
            await restartPlaybackWithNewPlaylist(playlistDirName, previewPlaylistDirPath);

            // Resetear contadores
            IndexCountFilesInDirPlaylist = 0;
            activePlaylistName = null;

            return res.json({
                success: true,
                message: 'Playlist procesada y reproduciendo correctamente',
                playlist: {
                    name: playlistDirName,
                    path: newPlaylistM3uPath,
                    totalFiles: countPlaylistItems
                }
            });
        }

        // Respuesta para archivos en proceso
        return res.json({
            success: true,
            message: 'Archivo procesado correctamente',
            progress: {
                current: IndexCountFilesInDirPlaylist,
                total: countPlaylistItems,
                filename: file.originalname
            }
        });

    } catch (error) {
        console.error('Error en el procesamiento del archivo:', error);
        return res.status(500).json({
            success: false,
            message: 'Error al procesar el archivo',
            error: error.message
        });
    }
});

// Nueva función para reiniciar la reproducción con la nueva playlist
async function restartPlaybackWithNewPlaylist(newPlaylistDirName, oldPlaylistDirPath) {
    try {
        console.log('Reiniciando reproducción con nueva playlist:', newPlaylistDirName);

        // Obtener la instancia del reproductor VLC
        const vlcPlayer = getVLCPlayerInstance();

        // Detener la reproducción actual
        console.log('Deteniendo la reproducción actual...');
        vlcPlayer.stop();

        // Esperar un momento para asegurar que VLC se haya detenido
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Iniciar la reproducción con la nueva playlist
        console.log('Iniciando reproducción de la nueva playlist...');
        const success = await vlcPlayer.start();

        if (success) {
            console.log('La nueva playlist se está reproduciendo correctamente.');

            // Si la reproducción es exitosa, ahora podemos eliminar el directorio anterior
            if (oldPlaylistDirPath && oldPlaylistDirPath !== path.join(appConfig.paths.videos, newPlaylistDirName)) {
                try {
                    console.log('Eliminando directorio de la playlist anterior:', oldPlaylistDirPath);
                    await fsPromises.rm(oldPlaylistDirPath, { recursive: true, force: true });
                    console.log('Directorio de la playlist anterior eliminado con éxito.');
                } catch (error) {
                    console.error('Error al eliminar el directorio de la playlist anterior:', error);
                    // No lanzamos el error aquí para no interrumpir el flujo principal
                }
            }

            // También podemos eliminar otros directorios antiguos que no sean ni la playlist actual ni la anterior
            await cleanupOldDirectories(newPlaylistDirName);
        } else {
            console.error('Error al iniciar la reproducción de la nueva playlist.');
        }
    } catch (error) {
        console.error('Error al reiniciar la reproducción:', error);
        throw error;
    }
}

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