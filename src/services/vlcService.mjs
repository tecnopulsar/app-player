import axios from 'axios';

const VLC_HOST = 'localhost';
const VLC_PORT = 8080;
const VLC_USERNAME = ''; // Usuario de VLC (por defecto está vacío)
const VLC_PASSWORD = 'tecno';

// Configuración global de axios para VLC
const vlcAxios = axios.create({
    baseURL: `http://${VLC_HOST}:${VLC_PORT}/requests/status.xml`,
    auth: {
        username: VLC_USERNAME,
        password: VLC_PASSWORD
    },
    timeout: 5000 // Tiempo máximo de espera para evitar bloqueos
});

// Función optimizada para hacer peticiones a VLC
export const vlcRequest = async (command, params = {}) => {
    try {
        // Validar que el comando no esté vacío
        if (!command) {
            throw new Error('El comando no puede estar vacío');
        }

        // Enviar la petición a VLC
        const response = await vlcAxios.get('', {
            params: {
                command,
                ...params // Parámetros adicionales (por ejemplo, input, volume, etc.)
            }
        });

        // Devolver la respuesta de VLC
        return response.data;
    } catch (error) {
        // Manejo de errores detallado
        if (error.response) {
            // Error en la respuesta de VLC (por ejemplo, comando no válido)
            console.error('Error en la respuesta de VLC:', error.response.data);
            throw new Error(`Error en VLC: ${error.response.data}`);
        } else if (error.request) {
            // Error de red (VLC no responde)
            console.error('Error de red:', error.message);
            throw new Error('No se pudo conectar con VLC. Verifica que esté en ejecución.');
        } else {
            // Error genérico
            console.error('Error en la petición VLC:', error.message);
            throw new Error(`Error al comunicarse con VLC: ${error.message}`);
        }
    }
};

// Comandos comunes para VLC
export const vlcCommands = {
    play: 'pl_play',
    pause: 'pl_pause',
    stop: 'pl_stop',
    next: 'pl_next',
    previous: 'pl_previous',
    fullscreen: 'fullscreen',
    toggleAudio: 'volume',
    getStatus: 'status',

    // Control de volumen
    volumeUp: 'volumeup',
    volumeDown: 'volumedown',
    setVolume: 'volume', // Ejemplo: volume 50 (para establecer el volumen al 50%)

    // Control de playlist
    getPlaylist: 'playlist', // Comando para obtener la información de la playlist
    addToPlaylist: 'in_enqueue', // Agrega un archivo o URL a la playlist
    clearPlaylist: 'pl_empty', // Borra toda la playlist
    deleteItemFromPlaylist: 'pl_delete', // Elimina un elemento específico de la playlist (necesita el ID del elemento)
    playItemFromPlaylist: 'pl_play', // Reproduce un elemento específico de la playlist (necesita el ID del elemento)
    shufflePlaylist: 'pl_random', // Activa o desactiva la reproducción aleatoria
    loopPlaylist: 'pl_loop', // Activa o desactiva la repetición de la playlist
    repeatItem: 'pl_repeat', // Activa o desactiva la repetición de un solo elemento

    // Navegación en la playlist
    goToNextItem: 'pl_next',
    goToPreviousItem: 'pl_previous',
    goToSpecificItem: 'pl_play', // Reproduce un elemento específico (necesita el ID del elemento)
    
    // Control de ventana y pantalla
    toggleFullscreen: 'fullscreen',
    minimize: 'minimize',
    maximize: 'maximize',

    // Control de subtítulos y pistas de audio
    toggleSubtitles: 'sub_toggle',
    nextSubtitleTrack: 'sub_next',
    previousSubtitleTrack: 'sub_previous',
    nextAudioTrack: 'audio_next',
    previousAudioTrack: 'audio_previous',

    // Control de velocidad de reproducción
    increaseSpeed: 'ratefaster',
    decreaseSpeed: 'rateslower',
    setSpeed: 'rate', // Ejemplo: rate 1.5 (para establecer la velocidad a 1.5x)

    // Saltar en la reproducción
    seekForward: 'seek +10', // Salta 10 segundos hacia adelante
    seekBackward: 'seek -10', // Salta 10 segundos hacia atrás
    seekToTime: 'seek', // Ejemplo: seek 120 (para saltar a 2 minutos)

    // Gestión de archivos y streams
    // openFile: 'in_open', // Abre un archivo para reproducir
    openFile: 'in_play', // Comando para reproducir directamente un archivo o playlist
    openFolder: 'in_open', // Abre una carpeta para agregar a la playlist
    openURL: 'in_open', // Abre una URL para reproducir

    // Otras funcionalidades
    takeSnapshot: 'snapshot', // Toma una captura de pantalla del video actual
    showPlaylist: 'playlist', // Muestra u oculta la lista de reproducción
    quit: 'quit', // Cierra VLC
};
