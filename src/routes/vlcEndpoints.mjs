import express from 'express';
import { vlcRequest, vlcCommands } from '../services/vlcService.mjs';
import { parseStringPromise } from 'xml2js';
import { appConfig } from '../config/appConfig.mjs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { updateActivePlaylist } from '../routes/playlistHandler.mjs';

const router = express.Router();

/**
 * @swagger
 * /api/vlc/status:
 *   get:
 *     summary: Obtiene el estado actual del reproductor VLC
 */
router.get('/status', async (req, res) => {
    try {
        const statusXml = await vlcRequest(vlcCommands.getStatus);
        const parsedXml = await parseStringPromise(statusXml);
        const { state, currentplid, fullscreen, volume, length, position } = parsedXml.root;

        res.json({
            state: state?.[0] || 'stopped',
            currentplid: currentplid?.[0] || '0',
            fullscreen: fullscreen?.[0] === '1',
            volume: volume?.[0] || '0',
            length: length?.[0] || '0',
            position: position?.[0] || '0',
        });
    } catch (error) {
        console.error(`Error fetching status: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Error al obtener el estado del reproductor',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/play:
 *   get:
 *     summary: Inicia la reproducción
 */
router.get('/play', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.play);
        res.json({ success: true, message: 'Reproducción iniciada' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al iniciar la reproducción',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/pause:
 *   get:
 *     summary: Pausa la reproducción
 */
router.get('/pause', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.pause);
        res.json({ success: true, message: 'Reproducción pausada' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al pausar la reproducción',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/stop:
 *   get:
 *     summary: Detiene la reproducción
 */
router.get('/stop', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.stop);
        res.json({ success: true, message: 'Reproducción detenida' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al detener la reproducción',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/playlist/load:
 *   post:
 *     summary: Carga una playlist en VLC
 */
router.post('/playlist/load', async (req, res) => {
    try {
        const { playlistPath } = req.body;

        // Validar que se proporcionó la ruta de la playlist
        if (!playlistPath) {
            return res.status(400).json({ error: 'Se requiere la ruta de la playlist' });
        }

        const fileUrl = `file://${playlistPath}`;

        // Limpiar la playlist actual
        await vlcRequest(vlcCommands.clearPlaylist);

        // Cargar la nueva playlist
        await vlcRequest(vlcCommands.openFile, {
            input: fileUrl
        });

        // Actualizar activePlaylist.json con la nueva playlist
        await updateActivePlaylist(fileUrl);

        res.json({
            success: true,
            message: 'Playlist cargada y reproduciendo',
            playlist: fileUrl
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cargar la playlist',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/playlist/clear:
 *   post:
 *     summary: Vacía la playlist actual
 */
router.post('/playlist/clear', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.clearPlaylist);
        res.json({
            success: true,
            message: 'Playlist vaciada correctamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al vaciar la playlist',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/playlist/info:
 *   get:
 *     summary: Obtiene información de la playlist actual
 */
router.get('/playlist/info', async (req, res) => {
    try {
        const playlistXml = await vlcRequest(vlcCommands.getPlaylist);
        const parsedXml = await parseStringPromise(playlistXml);
        res.json({
            success: true,
            playlist: parsedXml
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener información de la playlist',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/playlist/next:
 *   get:
 *     summary: Reproduce el siguiente elemento de la playlist
 */
router.get('/playlist/next', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.next);
        res.json({
            success: true,
            message: 'Siguiente elemento de la playlist'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cambiar al siguiente elemento',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/vlc/playlist/previous:
 *   get:
 *     summary: Reproduce el elemento anterior de la playlist
 */
router.get('/playlist/previous', async (req, res) => {
    try {
        await vlcRequest(vlcCommands.previous);
        res.json({
            success: true,
            message: 'Elemento anterior de la playlist'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al cambiar al elemento anterior',
            error: error.message
        });
    }
});

export default router; 