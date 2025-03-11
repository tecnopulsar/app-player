import fs from 'fs/promises';
import path from 'path';
import { appConfig } from '../config/appConfig.mjs';
import { spawn } from 'child_process';

async function setupDirectories() {
    const directories = [
        appConfig.paths.uploads,
        appConfig.paths.videos,
        appConfig.paths.videosDefecto,
        appConfig.paths.playlistDefecto,
        appConfig.paths.screenshots,
        appConfig.paths.images,
        appConfig.paths.temp
    ];

    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✅ Directorio creado/verificado: ${dir}`);
        } catch (error) {
            console.error(`❌ Error al crear directorio ${dir}:`, error);
        }
    }
}

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

        // Limpiar la playlist actual
        console.log('Limpiando la playlist actual...');
        vlcPlayer.toggleAudio(); // Alternar audio para enviar un comando a VLC
        vlcPlayer.process.stdin.write('key key-stop\n'); // Detener la reproducción
        vlcPlayer.process.stdin.write('key key-clear\n'); // Limpiar la playlist

        // Esperar un momento para asegurar que la playlist se haya limpiado
        await new Promise(resolve => setTimeout(resolve, 1000));

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

async function getVLCPlayerInstance() {
    // Implementa la lógica para obtener una instancia del reproductor VLC
    // Esto puede ser una instancia existente o una nueva creación
    return new VLCPlayer();
}

export class VLCPlayer {
    #process = null; // Campo privado para el proceso de VLC
    #playlistPath = null; // Campo privado para la ruta de la playlist
    #watchdog = null; // Campo privado para el watchdog

    // Constructor de la clase
    constructor() {
        // Inicialización si es necesario
    }

    // Métodos de la clase
    async start() {
        try {
            this.#playlistPath = await this.getPlaylistPath();
            if (!this.#playlistPath) {
                throw new Error('No se encontró la playlist o los videos referenciados');
            }

            // Configuración de VLC
            const options = [
                '--loop',                     // Reproducción en bucle
                '--no-audio',                 // Sin audio por defecto (puedes eliminar esta opción si deseas audio)
                '--intf=qt',                  // Usar la interfaz gráfica de usuario Qt
                '--http-port=8080',           // Puerto HTTP
                '--http-password=tecno',      // Contraseña HTTP
                '--http-host=localhost',      // Host HTTP
                this.#playlistPath             // Ruta de la playlist
            ];

            // Iniciar VLC
            this.#process = spawn('vlc', options);

            // Manejar la salida
            this.#process.stdout.on('data', data => {
                console.log(`VLC stdout: ${data}`);
            });

            this.#process.stderr.on('data', data => {
                console.error(`VLC stderr: ${data}`);
            });

            // Manejar el cierre
            this.#process.on('close', code => {
                console.log(`VLC se cerró con código ${code}`);
                this.#process = null;

                // Si el código no es 0 (error), intentar reiniciar
                if (code !== 0) {
                    this.restart();
                }
            });

            // Implementar un watchdog simple
            this.setupWatchdog();

            return true;
        } catch (error) {
            console.error('Error al iniciar VLC:', error);
            return false;
        }
    }

    async stop() {
        // Implementa la lógica para detener VLC
    }

    async toggleAudio() {
        // Implementa la lógica para alternar el audio
    }

    async getPlaylistPath() {
        // Implementa la lógica para obtener la ruta de la playlist
    }

    async setupWatchdog() {
        // Implementa la lógica para configurar el watchdog
    }

    async restart() {
        // Implementa la lógica para reiniciar VLC
    }
}

export { setupDirectories }; 