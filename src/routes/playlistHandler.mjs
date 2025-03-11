import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { appConfig } from '../config/appConfig.mjs';
// Importar el VLCPlayer para controlar la reproducción
import { VLCPlayer } from '../lib/vlcPlayer.js';

const router = express.Router();

const ACTIVE_PLAYLIST_PATH = path.join(process.cwd(), appConfig.paths.activePlaylist);
console.log("🚀 ~ ACTIVE_PLAYLIST_PATH:", ACTIVE_PLAYLIST_PATH)
const PLAYLIST_DIR = path.dirname(ACTIVE_PLAYLIST_PATH);
console.log("🚀 ~ PLAYLIST_DIR:", PLAYLIST_DIR)
const DEFAULT_PLAYLIST_NAME = appConfig.paths.playlistDefecto; // Ruta de la playlist por defecto
console.log("🚀 ~ DEFAULT_PLAYLIST_NAME:", DEFAULT_PLAYLIST_NAME)




// Función para inicializar el archivo activePlaylist.json
const initializeActivePlaylist = async () => {
    try {
        // Crear el directorio si no existe
        await fsPromises.mkdir(PLAYLIST_DIR, { recursive: true });

        // Verificar si el archivo existe
        try {
            await fsPromises.access(ACTIVE_PLAYLIST_PATH);
        } catch {
            // Si el archivo no existe, verificar condiciones para establecer la playlist por defecto
            const historyEmpty = await isHistoryEmpty();
            const playlistsExist = await hasPlaylistDirectories();

            const initialData = {
                active: (historyEmpty && !playlistsExist) ? DEFAULT_PLAYLIST_NAME : null, // Establecer la playlist por defecto si se cumplen las condiciones
                updatedAt: new Date().toISOString()
            };
            await fsPromises.writeFile(
                ACTIVE_PLAYLIST_PATH,
                JSON.stringify(initialData, null, 2)
            );
        }
    } catch (error) {
        console.error('Error al inicializar activePlaylist.json:', error);
        throw error;
    }
};

// Función para actualizar la playlist activa
export const updateActivePlaylist = async (playlistName) => {
    try {
        await initializeActivePlaylist(); // Asegurarse de que el archivo existe

        const activePlaylistData = {
            active: playlistName, // Establecer la playlist activa
            updatedAt: new Date().toISOString()
        };
        await fsPromises.writeFile(
            ACTIVE_PLAYLIST_PATH,
            JSON.stringify(activePlaylistData, null, 2)
        );
    } catch (error) {
        console.error('Error al actualizar activePlaylist.json:', error);
        throw error;
    }
};

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

// Obtener la playlist activa actual
router.get('/active', async (req, res) => {
    try {
        await initializeActivePlaylist(); // Asegurarse de que el archivo existe
        const activePlaylist = await fsPromises.readFile(ACTIVE_PLAYLIST_PATH, 'utf-8');
        res.json(JSON.parse(activePlaylist));
    } catch (error) {
        console.error('Error al obtener la playlist activa:', error);
        res.status(500).json({
            error: 'Error al obtener la playlist activa',
            details: error.message
        });
    }
});

// Establecer una nueva playlist activa
router.post('/active/:playlistName', async (req, res) => {
    try {
        const { playlistName } = req.params;
        const playlistPath = path.join(process.cwd(), appConfig.paths.videos, playlistName);
        console.log("🚀 ~ router.post ~ playlistPath:", playlistPath)

        // Verificar si la playlist existe
        const exists = await fsPromises.access(playlistPath).then(() => true).catch(() => false);
        console.log("🚀 ~ router.post ~ exists:", exists)
        if (!exists) {
            return res.status(404).json({ error: 'Playlist no encontrada' });
        }

        // Cargar la playlist en VLC y establecerla como activa
        await loadPlaylistInVLC(playlistPath);
        res.json({ message: 'Playlist activa actualizada', active: playlistName });
    } catch (error) {
        res.status(500).json({ error: 'Error al establecer la playlist activa' });
    }
});

// Borrar historial de playlist
router.delete('/history', async (req, res) => {
    try {
        await fsPromises.writeFile(path.join(appConfig.paths.videos, 'history.json'), JSON.stringify([]));
        res.json({ message: 'Historial de playlist borrado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al borrar el historial' });
    }
});

// Eliminar una playlist específica
router.delete('/:playlistName', async (req, res) => {
    try {
        const { playlistName } = req.params;
        const playlistPath = path.join(appConfig.paths.videos, playlistName);

        await fsPromises.rm(playlistPath, { recursive: true, force: true });
        res.json({ message: 'Playlist eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar la playlist' });
    }
});

// Eliminar todas las playlists
router.delete('/', async (req, res) => {
    try {
        const playlists = await fsPromises.readdir(appConfig.paths.videos);

        // Eliminar cada directorio de playlist, excluyendo archivos de configuración
        await Promise.all(playlists
            .filter(item => !item.endsWith('.json'))
            .map(playlist => fsPromises.rm(path.join(appConfig.paths.videos, playlist), { recursive: true, force: true }))
        );

        res.json({ message: 'Todas las playlists han sido eliminadas' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar todas las playlists' });
    }
});

// Inicializar el archivo al arrancar el router
initializeActivePlaylist().catch(console.error);

// Función para verificar si el historial de playlists está vacío
const isHistoryEmpty = async () => {
    try {
        const historyPath = path.join(process.cwd(), appConfig.paths.videos, 'history.json');
        const historyData = await fsPromises.readFile(historyPath, 'utf-8');
        const history = JSON.parse(historyData);
        return history.length === 0; // Retorna true si el historial está vacío
    } catch (error) {
        console.error('Error al verificar el historial de playlists:', error);
        return false; // Si hay un error, asumimos que no está vacío
    }
};

// Función para verificar si hay directorios que comiencen con "playlist_"
const hasPlaylistDirectories = async () => {
    try {
        const dirs = await fsPromises.readdir(path.join(process.cwd(), appConfig.paths.videos));
        return dirs.some(dir => dir.startsWith('playlist_')); // Retorna true si hay directorios que comienzan con "playlist_"
    } catch (error) {
        console.error('Error al verificar los directorios de playlists:', error);
        return false; // Si hay un error, asumimos que no hay directorios
    }
};

export default router; 