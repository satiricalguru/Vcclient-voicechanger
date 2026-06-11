const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.setAppUserModelId('com.voice.changer.client');

const MAX_RETRIES = 10;
const RETRY_INTERVAL = 1000;

const testMode = process.argv.includes('--test');

// Clear previous logs
if (fs.existsSync(path.join(__dirname, 'console_logs.txt'))) {
  fs.unlinkSync(path.join(__dirname, 'console_logs.txt'));
}

function createWindow() {
  // Resolve icon path — prefer root-level ICO for Windows taskbar
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'app-icon.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, 'dist', 'web_front', 'assets', 'icons', 'app-icon.ico');
    }
  } else {
    iconPath = path.join(__dirname, 'dist', 'web_front', 'assets', 'icons', 'app-icon.png');
  }

  const appIcon = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    show: !testMode, // Run hidden in test mode
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Voice Changer",
    icon: appIcon,
    autoHideMenuBar: true,
    backgroundColor: '#08080f'
  });

  // Capture console logs from the webview in test mode only
  if (testMode) {
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const logMsg = `[LEVEL ${level}] ${message} (at ${path.basename(sourceId)}:${line})\n`;
      fs.appendFileSync(path.join(__dirname, 'console_logs.txt'), logMsg);
    });
  }

  let retries = 0;

  function loadApp() {
    win.loadURL('http://127.0.0.1:18000').catch((err) => {
      console.error('Failed to load URL:', err.message);
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_INTERVAL}ms... (attempt ${retries}/${MAX_RETRIES})`);
        setTimeout(loadApp, RETRY_INTERVAL);
      } else {
        console.error('Max retries reached. Unable to connect to backend.');
        if (testMode) {
          process.exit(1);
        }
        win.loadURL('data:text/html,<h1>Unable to connect to Voice Changer backend</h1><p>Please ensure the backend is running on port 18000.</p>');
      }
    });
  }

  if (testMode) {
    win.webContents.on('did-finish-load', () => {
      // Wait for React to mount and modern-ui.js to execute
      setTimeout(async () => {
        try {
          const html = await win.webContents.executeJavaScript('document.body.innerHTML');
          fs.writeFileSync(path.join(__dirname, 'dom_dump.html'), html);
          console.log('Rendered DOM dumped to dom_dump.html');
        } catch (err) {
          console.error('Error dumping DOM:', err.message);
        } finally {
          console.log('Test execution finished. Exiting.');
          app.quit();
        }
      }, 4000);
    });
  }

  loadApp();

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

