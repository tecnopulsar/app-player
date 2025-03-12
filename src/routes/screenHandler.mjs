import { Router } from 'express';
import { screen, BrowserWindow } from 'electron';

const router = Router();

// Ruta para obtener información sobre las pantallas conectadas
router.get('/displays', (req, res) => {
    const displays = screen.getAllDisplays();
    res.json(displays);
});

// Ruta para poner una ventana en pantalla completa
router.post('/fullscreen', (req, res) => {
    const { title } = req.body; // Obtener el título de la ventana del cuerpo de la solicitud
    if (title) {
        const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === title);
        if (win) {
            win.setFullScreen(true);
            res.status(200).send(`La ventana "${title}" se ha puesto en pantalla completa.`);
        } else {
            res.status(404).send(`No se encontró la ventana con el título "${title}".`);
        }
    } else {
        res.status(400).send('Título de la ventana no proporcionado.');
    }
});

// Nuevo endpoint para obtener información sobre una ventana específica
router.post('/info', (req, res) => {
    const { title } = req.body; // Obtener el título de la ventana del cuerpo de la solicitud
    if (title) {
        const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === title);
        if (win) {
            const windowInfo = {
                title: win.getTitle(),
                isFullScreen: win.isFullScreen(),
                size: win.getSize(),
                position: win.getPosition(),
                isVisible: win.isVisible(),
                isMaximized: win.isMaximized(),
                isMinimized: win.isMinimized(),
            };
            res.status(200).json(windowInfo);
        } else {
            res.status(404).send(`No se encontró la ventana con el título "${title}".`);
        }
    } else {
        res.status(400).send('Título de la ventana no proporcionado.');
    }
});

// Nuevo endpoint para minimizar la ventana de VLC
router.post('/minimize', (req, res) => {
    const { title } = req.body; // Obtener el título de la ventana del cuerpo de la solicitud
    if (title) {
        const win = BrowserWindow.getAllWindows().find(w => w.getTitle() === title);
        if (win) {
            win.minimize(); // Minimizar la ventana
            res.status(200).send(`La ventana "${title}" ha sido minimizada.`);
        } else {
            res.status(404).send(`No se encontró la ventana con el título "${title}".`);
        }
    } else {
        res.status(400).send('Título de la ventana no proporcionado.');
    }
});

export default router; 