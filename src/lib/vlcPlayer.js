import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getActivePlaylist, initializeActivePlaylist } from '../services/vlcService.mjs';

export class VLCPlayer {
    #process = null;
    #playlistPath = null;
    #watchdog = null;

    constructor() {
        this.playlistPath = null;
    }

    async initialize() {
        try {
            // Obtener la playlist activa desde el archivo JSON
            const activePlaylist = await this.getPlaylistPath();
            if (activePlaylist) {
                console.log('Playlist activa encontrada:', activePlaylist);
                this.playlistPath = activePlaylist;
                await this.loadPlaylist(activePlaylist);
            } else {
                console.error('No se pudo encontrar una playlist activa.');
            }
        } catch (error) {
            console.error('Error al inicializar VLCPlayer:', error);
        }
    }

    async getPlaylistPath() {
        try {
            // Leer la playlist activa desde el archivo JSON
            const activePlaylist = getActivePlaylist();
            console.log('Playlist activa desde JSON:', activePlaylist);

            // Verificar que el archivo de la playlist activa existe
            await fs.access(activePlaylist);

            // Leer y verificar el contenido de la playlist
            const playlistContent = await fs.readFile(activePlaylist, 'utf8');
            const entries = playlistContent
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'));

            if (entries.length === 0) {
                throw new Error('La playlist está vacía o no contiene entradas válidas');
            }

            // Verificar que los archivos referenciados existen
            await Promise.all(entries.map(async entry => {
                const fileName = path.basename(entry.trim());
                const videoPath = path.join(path.dirname(activePlaylist), fileName);
                await fs.access(videoPath);
                console.log('Video encontrado:', videoPath);
            }));

            return activePlaylist;
        } catch (error) {
            console.error('Error al obtener la ruta de la playlist:', error);
            return null;
        }
    }

    async loadPlaylist(playlistPath) {
        // Lógica para cargar la playlist en VLC
        console.log(`Cargando playlist: ${playlistPath}`);
        // Aquí deberías implementar la lógica para cargar la playlist en VLC
    }

    async start() {
        try {
            // Verificar si el archivo activePlaylist.json existe
            const activePlaylistPath = path.join(process.cwd(), 'src', 'config', 'activePlaylist.json');
            try {
                await fs.access(activePlaylistPath);
            } catch {
                console.warn('El archivo activePlaylist.json no existe. Inicializando con valores predeterminados.');
                initializeActivePlaylist(); // Inicializar el archivo si no existe
            }

            this.#playlistPath = await this.getPlaylistPath();
            if (!this.#playlistPath) {
                throw new Error('No se encontró la playlist o los videos referenciados');
            }

            const options = [
                '--loop',
                '--no-audio',
                '--no-video-title-show',
                '--no-video-deco',       // Esta opción también ayuda a eliminar elementos de la interfaz
                // '--no-mouse-events',
                '--intf=http',
                '--http-port=8080',
                '--http-password=tecno',
                '--http-host=localhost',
                '--fullscreen', // Agregar opción para iniciar en pantalla completa
                this.#playlistPath
            ];

            this.#process = spawn('vlc', options);

            this.#process.stdout.on('data', data => console.log(`VLC stdout: ${data}`));
            this.#process.stderr.on('data', data => console.error(`VLC stderr: ${data}`));
            this.#process.on('close', code => {
                console.log(`VLC se cerró con código ${code}`);
                this.#process = null;
                if (code !== 0) this.restart();
            });

            this.#setupWatchdog();
            return true;
        } catch (error) {
            console.error('Error al iniciar VLC:', error);
            return false;
        }
    }

    #setupWatchdog() {
        let watchdogInterval = null;

        const checkProcess = () => {
            if (this.#process?.exitCode === null) {
                console.log('VLC está funcionando correctamente');
            } else {
                console.error('VLC no está funcionando, intentando reiniciar...');
                this.restart();
            }
        };

        setTimeout(() => {
            watchdogInterval = setInterval(checkProcess, 30000);
        }, 5000);

        this.#watchdog = {
            start: () => {
                if (!watchdogInterval) {
                    watchdogInterval = setInterval(checkProcess, 30000);
                }
            },
            stop: () => {
                if (watchdogInterval) {
                    clearInterval(watchdogInterval);
                    watchdogInterval = null;
                }
            }
        };
    }

    async restart() {
        console.log('Reiniciando VLC...');
        this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.start();
    }

    stop() {
        if (this.#process) {
            this.#watchdog?.stop();
            this.#process.kill();
            this.#process = null;
        }
    }

    toggleAudio() {
        this.#process?.stdin.write('key key-audio-track\n');
    }
} 