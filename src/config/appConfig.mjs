// Configuración general de la aplicación
const appConfig = {
    // Configuración del servidor
    server: {
        port: 3000,
        host: 'localhost'
    },

    // Configuración de rutas
    paths: {
        public: './public',
        videos: './public/videos',
        videosDefecto: './public/videosDefecto',
        playlistDefecto: './public/videosDefecto/playlistDefecto',
        activePlaylist: './public/videos/playlist/activePlaylist.json',
        screenshots: './public/screenshots',
        images: './public/images',
        uploads: './public/uploads',
        temp: './public/temp'
    },

    // Configuración de la aplicación
    app: {
        name: 'App Player',
        version: '1.0.0',
        debug: process.env.NODE_ENV === 'development'
    },

    // Configuración de seguridad
    security: {
        allowedOrigins: ['http://localhost:3000'],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedFileTypes: ['video/*', 'image/*', 'audio/*']
    }
};

// Exportar las configuraciones
export { appConfig };
