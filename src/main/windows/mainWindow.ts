import { BrowserWindow, app } from 'electron';
import path from 'path';

const getRendererUrl = () => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return devServerUrl;
  }

  return path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
};

export const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const rendererUrl = getRendererUrl();
  if (rendererUrl.startsWith('http')) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(rendererUrl);
  }

  return mainWindow;
};
