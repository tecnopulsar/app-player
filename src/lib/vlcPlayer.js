import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { appConfig } from '../config/appConfig.mjs';

export class VLCPlayer {
    #process = null;
    #playlistPath = null;
    #watchdog = null;

    async #findCustomPlaylist() {
        try {
            const videosPath = appConfig.paths.videos;
            const items = await fs.readdir(videosPath);

            // Buscar la primera carpeta que comience con 'playlist_'
            const playlistFolder = items.find(async item => {
                const fullPath = path.join(videosPath, item);
                const stat = await fs.stat(fullPath);
                return item.startsWith('playlist_') && stat.isDirectory();
            });

            if (playlistFolder) {
                const folderPath = path.join(videosPath, playlistFolder);
                const files = await fs.readdir(folderPath);
                const playlistFile = files.find(file => file.endsWith('.m3u'));

                if (playlistFile) {
                    return path.join(folderPath, playlistFile);
                }
            }
            return null;
        } catch (error) {
            console.error('Error buscando playlist personalizada:', error);
            return null;
        }
    }

    async getPlaylistPath() {
        try {
            // Primero intentar encontrar una playlist personalizada
            const customPlaylist = await this.#findCustomPlaylist();
            if (customPlaylist) {
                console.log('Playlist personalizada encontrada:', customPlaylist);
                return customPlaylist;
            }

            // Si no hay playlist personalizada, usar la playlist por defecto
            const defaultPlaylist = path.join(appConfig.paths.videosDefecto, 'playlistDefecto', 'playlistDefecto.m3u');
            console.log("Usando playlist por defecto:", defaultPlaylist);

            // Verificar que el archivo existe
            await fs.access(defaultPlaylist);

            // Leer y verificar el contenido de la playlist
            const playlistContent = await fs.readFile(defaultPlaylist, 'utf8');
            const entries = playlistContent
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'));

            if (entries.length === 0) {
                throw new Error('La playlist está vacía o no contiene entradas válidas');
            }

            // Verificar que los archivos referenciados existen
            await Promise.all(entries.map(async entry => {
                const fileName = path.basename(entry.trim());
                const videoPath = path.join(appConfig.paths.videosDefecto, 'playlistDefecto', fileName);
                await fs.access(videoPath);
                console.log('Video encontrado:', videoPath);
            }));

            return defaultPlaylist;
        } catch (error) {
            console.error('Error al obtener la ruta de la playlist:', error);
            return null;
        }
    }

    async start() {
        try {
            this.#playlistPath = await this.getPlaylistPath();
            if (!this.#playlistPath) {
                throw new Error('No se encontró la playlist o los videos referenciados');
            }

            const options = [
                '--loop',
                '--no-audio',
                '--no-video-title-show',
                '--no-video-deco',
                '--no-mouse-events',
                '--intf=http',
                '--http-port=8080',
                '--http-password=tecno',
                '--http-host=localhost',
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