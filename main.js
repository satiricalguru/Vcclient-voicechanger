const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

// Single instance lock to prevent duplicate app windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Primary instance logic
  app.setAppUserModelId('com.voice.changer.client');

  const MAX_RETRIES = 15;
  const RETRY_INTERVAL = 1000;

  const testMode = process.argv.includes('--test');

  // Clear previous logs
  if (fs.existsSync(path.join(__dirname, 'console_logs.txt'))) {
    try {
      fs.unlinkSync(path.join(__dirname, 'console_logs.txt'));
    } catch (e) {}
  }

  // Determine paths for packaged vs development run
  const isPackaged = app.isPackaged;
  const baseDir = isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked') 
    : __dirname;

  const pythonExe = path.join(baseDir, 'dist', 'main.exe');
  // Pass arguments as separate items (space-separated) to match start_http.bat exactly.
  // Using = (e.g. --no_cui=True) causes the Python backend CLI parser to fail, which defaults to launching the GUI window.
  const args = ['cui', '--https', 'false', '--no_cui', 'True'];

  let backend = null;
  let isShuttingDown = false;
  let logStream = null;

  try {
    const logPath = path.join(app.getPath('userData'), 'backend.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    logStream = fs.openSync(logPath, 'a');
  } catch (e) {
    console.error('Failed to open backend log file:', e.message);
  }

  // Kill any previously orphaned main.exe instances to prevent port binding conflicts
  if (process.platform === 'win32') {
    try {
      console.log('Cleaning up existing main.exe processes...');
      execSync('taskkill /F /IM main.exe', { stdio: 'ignore' });
    } catch (e) {
      // No existing processes to kill
    }
  }

  function killProcessTree(pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch (err) {
      // Already terminated or permission issue
    }
  }

  function startBackend() {
    console.log(`Starting Voice Changer Backend: ${pythonExe} ${args.join(' ')}`);

    const stdioOption = logStream ? ['ignore', logStream, logStream] : 'ignore';
    backend = spawn(pythonExe, args, {
      cwd: path.join(baseDir, 'dist'),
      stdio: stdioOption,
      shell: false,
      windowsHide: true, // This prevents the black cmd window from appearing
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    backend.on('error', (err) => {
      console.error('Failed to start backend:', err.message);
      if (!isShuttingDown) {
        console.log('Retrying in 3 seconds...');
        setTimeout(startBackend, 3000);
      }
    });

    backend.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        console.log('Backend process exited, restarting in 3 seconds...');
        setTimeout(startBackend, 3000);
      }
    });
  }

  // Start the backend
  startBackend();

  function shutdown() {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log('Terminating Voice Changer backend...');

    if (backend && !backend.killed) {
      killProcessTree(backend.pid);
    }
    
    if (logStream) {
      try {
        fs.closeSync(logStream);
      } catch (e) {}
    }
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
    let testTriggered = false;

    function loadApp() {
      win.loadURL('http://127.0.0.1:18000').then(() => {
        console.log('Successfully loaded URL: http://127.0.0.1:18000');
        if (testMode && !testTriggered) {
          testTriggered = true;
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
        }
      }).catch((err) => {
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

    loadApp();

    return win;
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length) {
      const win = windows[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

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

  // Clean up when app is quitting
  app.on('will-quit', () => {
    shutdown();
  });
}
