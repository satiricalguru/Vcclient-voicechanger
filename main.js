const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const https = require('https');
const http = require('http');

// Single instance lock to prevent duplicate app windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Primary instance logic
  app.setAppUserModelId('com.voice.changer.client');

  const MAX_RETRIES = 30;
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
  // Pass arguments using the flag=value format to ensure correct boolean evaluation by Google Fire.
  const args = ['cui', '--https=false', '--no_cui=True', '--launch_client=False'];

  let backend = null;
  let isShuttingDown = false;
  let logStream = null;
  let mainWin = null;
  let backendRestartTimer = null;

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

  // Clean up old PyInstaller temp directories
  try {
    const customTempDir = path.join(baseDir, 'tmp_dir');
    if (fs.existsSync(customTempDir)) {
      console.log('Cleaning up old temp directories in tmp_dir...');
      const files = fs.readdirSync(customTempDir);
      for (const file of files) {
        if (file.startsWith('_MEI')) {
          try {
            fs.rmSync(path.join(customTempDir, file), { recursive: true, force: true });
            console.log(`Cleaned up old temp directory: ${file}`);
          } catch (e) {
            // Directory might be locked by running processes
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to clean up old temp directories:', e.message);
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

  function downloadFile(url, destPath, filename, win, isApi = false) {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch (e) {}
      }

      const file = fs.createWriteStream(destPath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const urlObj = new URL(url);
      const headers = {
        'User-Agent': 'electron-downloader'
      };

      if (isApi && urlObj.hostname.endsWith('github.com') && process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
        headers['Accept'] = 'application/octet-stream';
      }

      const options = {
        headers: headers
      };

      const request = https.get(url, options, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.end();
          file.on('finish', () => {
            try { fs.unlinkSync(destPath); } catch(e) {}
            downloadFile(response.headers.location, destPath, filename, win, false)
              .then(resolve)
              .catch(reject);
          });
          return;
        }

        if (response.statusCode !== 200) {
          file.end();
          file.on('finish', () => {
            try { fs.unlinkSync(destPath); } catch(e) {}
            reject(new Error(`Server returned status code ${response.statusCode}`));
          });
          return;
        }

        totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        console.log(`Starting download for ${filename}. Expected size: ${totalBytes} bytes`);

        // Register the finish event only for the actual 200 response download
        file.on('finish', () => {
          console.log(`Finished writing ${filename} to disk.`);
          resolve();
        });

        response.pipe(file);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = Math.round((downloadedBytes / totalBytes) * 100);
            const mbDownloaded = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
            
            win.webContents.executeJavaScript(`
              if (document.getElementById('progress')) {
                document.getElementById('progress').style.width = '${percent}%';
                document.getElementById('status').innerText = 'Downloading ${filename}... ${percent}%';
                document.getElementById('details').innerText = '${mbDownloaded} MB of ${mbTotal} MB';
              }
            `).catch(() => {});
          }
        });
      });

      request.on('error', (err) => {
        file.end();
        file.on('finish', () => {
          try { fs.unlinkSync(destPath); } catch(e) {}
          reject(err);
        });
      });

      file.on('error', (err) => {
        file.end();
        reject(err);
      });
    });
  }

  function extractZip(zipPath, destDir, win) {
    return new Promise((resolve, reject) => {
      win.webContents.executeJavaScript(`
        if (document.getElementById('status')) {
          document.getElementById('status').innerText = 'Extracting files...';
          document.getElementById('details').innerText = 'This may take a minute.';
          document.getElementById('progress').style.width = '100%';
        }
      `).catch(() => {});

      try {
        execSync(`tar -x -f "${zipPath}" -C "${destDir}"`, { stdio: 'ignore' });
        try { fs.unlinkSync(zipPath); } catch (e) {}
        resolve();
      } catch (tarErr) {
        console.warn('tar extraction failed, falling back to powershell:', tarErr.message);
        try {
          execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'ignore' });
          try { fs.unlinkSync(zipPath); } catch (e) {}
          resolve();
        } catch (psErr) {
          reject(new Error(`Extraction failed: ${psErr.message}`));
        }
      }
    });
  }

  function getAssetIdAndDownloadUrl(filename) {
    return new Promise((resolve, reject) => {
      if (!process.env.GITHUB_TOKEN) {
        resolve({
          url: `https://github.com/satiricalguru/Vcclient-voicechanger/releases/download/v2.0.78-beta/${filename}`,
          isApi: false
        });
        return;
      }

      const url = 'https://api.github.com/repos/satiricalguru/Vcclient-voicechanger/releases/tags/v2.0.78-beta';
      const options = {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'electron-downloader'
        }
      };

      https.get(url, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to query release tags: status ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const release = JSON.parse(data);
            const asset = release.assets.find(a => a.name === filename);
            if (!asset) {
              reject(new Error(`Asset ${filename} not found in release`));
              return;
            }
            resolve({
              url: `https://api.github.com/repos/satiricalguru/Vcclient-voicechanger/releases/assets/${asset.id}`,
              isApi: true
            });
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async function checkAndDownloadResources() {
    const sentinelModules = path.join(baseDir, 'dist', 'modules', 'rmvpe', 'rmvpe_20231006.onnx');
    const sentinelModels = path.join(baseDir, 'dist', 'model_dir', '0', 'kikoto_kurage_v2_40k_e100_float.onnx');

    const needsModules = !fs.existsSync(sentinelModules);
    const needsModels = !fs.existsSync(sentinelModels);

    if (!needsModules && !needsModels) {
      return;
    }

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

    const downloadWin = new BrowserWindow({
      width: 550,
      height: 350,
      resizable: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      backgroundColor: '#08080f',
      alwaysOnTop: true,
      center: true,
      icon: appIcon,
      title: "VCClient Initializer"
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            background: #08080f;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
          }
          .container {
            width: 80%;
            text-align: center;
          }
          h2 {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 2px;
            margin: 0 0 10px 0;
            background: linear-gradient(135deg, #a78bfa, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
          }
          .status-text {
            font-size: 13px;
            color: #9ca3af;
            margin-bottom: 20px;
            height: 18px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .progress-track {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 15px;
            position: relative;
          }
          .progress-bar {
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #6366f1, #a78bfa);
            transition: width 0.1s ease;
            border-radius: 3px;
          }
          .details {
            font-size: 11px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Initializing Voice Changer</h2>
          <div id="status" class="status-text">Preparing downloader...</div>
          <div class="progress-track">
            <div id="progress" class="progress-bar"></div>
          </div>
          <div id="details" class="details">Checking download sources...</div>
        </div>
      </body>
      </html>
    `;
    downloadWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    let downloadSuccess = false;

    downloadWin.on('closed', () => {
      if (!downloadSuccess) {
        console.log('Downloader window closed by user. Quitting.');
        app.quit();
        process.exit(0);
      }
    });

    const tempDir = app.getPath('temp');
    const distDir = path.join(baseDir, 'dist');
    fs.mkdirSync(distDir, { recursive: true });

    try {
      if (needsModules) {
        const zipPath = path.join(tempDir, 'modules.zip');
        const assetInfo = await getAssetIdAndDownloadUrl('modules.zip');
        await downloadFile(assetInfo.url, zipPath, 'modules.zip', downloadWin, assetInfo.isApi);
        await extractZip(zipPath, distDir, downloadWin);
      }

      if (needsModels) {
        const zipPath = path.join(tempDir, 'model_dir.zip');
        const assetInfo = await getAssetIdAndDownloadUrl('model_dir.zip');
        await downloadFile(assetInfo.url, zipPath, 'model_dir.zip', downloadWin, assetInfo.isApi);
        await extractZip(zipPath, distDir, downloadWin);
      }

      downloadSuccess = true;
      downloadWin.close();
    } catch (err) {
      console.error('Resource download error:', err);
      await downloadWin.webContents.executeJavaScript(`
        if (document.getElementById('status')) {
          document.getElementById('status').innerText = 'Error: ' + ${JSON.stringify(err.message)};
          document.getElementById('details').innerText = 'Please restart the app to retry.';
          document.getElementById('progress').style.background = '#ef4444';
        }
      `).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 5000));
      throw err;
    }
  }

  // Creates a tiny no-op .exe so Python's webbrowser.open() calls it and returns
  // "success" without actually opening Chrome/Edge via os.startfile() fallback.
  // Python's shutil.which() only recognises real .exe files on Windows, so
  // BROWSER=echo (a shell built-in) doesn't work — we need an actual executable.
  function ensureNoopBrowserExe() {
    if (process.platform !== 'win32') return null;
    const exePath = path.join(baseDir, 'dist', 'noop-browser.exe');
    if (fs.existsSync(exePath)) return exePath;
    try {
      const cs = 'public class N{public static void Main(string[] a){}}'
        .replace(/'/g, "'");
      execSync(
        `powershell -NoProfile -Command "Add-Type -TypeDefinition '${cs}' -OutputAssembly '${exePath}' -OutputType ConsoleApplication"`,
        { timeout: 15000, stdio: 'ignore' }
      );
      console.log('Created noop-browser.exe to suppress backend browser launch.');
      return exePath;
    } catch (e) {
      console.warn('Could not create noop-browser.exe:', e.message);
      return null;
    }
  }

  // Creates a silent background executable that sleeps forever.
  // We use this to replace voice-changer-native-client.exe so that
  // the python backend's wait() block is satisfied without launching a second GUI window.
  function ensureSilentWaitExe() {
    if (process.platform !== 'win32') return null;
    const exePath = path.join(baseDir, 'dist', 'silent-wait.exe');
    if (fs.existsSync(exePath)) return exePath;
    try {
      const cs = 'public class N{public static void Main(){System.Threading.Thread.Sleep(-1);}}';
      execSync(
        `powershell -NoProfile -Command "Add-Type -TypeDefinition '${cs}' -OutputAssembly '${exePath}' -OutputType WindowsApplication"`,
        { timeout: 15000, stdio: 'ignore' }
      );
      console.log('Created silent-wait.exe to suppress backend shutdown.');
      return exePath;
    } catch (e) {
      console.warn('Could not create silent-wait.exe:', e.message);
      return null;
    }
  }

  function startBackend(noopBrowserExe) {
    console.log(`Starting Voice Changer Backend: ${pythonExe} ${args.join(' ')}`);

    const silentWaitExe = ensureSilentWaitExe();

    const customTempDir = path.join(baseDir, 'tmp_dir');
    if (!fs.existsSync(customTempDir)) {
      fs.mkdirSync(customTempDir, { recursive: true });
    }

    const stdioOption = logStream ? ['ignore', logStream, logStream] : 'ignore';
    backend = spawn(pythonExe, args, {
      cwd: path.join(baseDir, 'dist'),
      stdio: stdioOption,
      shell: false,
      windowsHide: true, // This prevents the black cmd window from appearing
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TEMP: customTempDir,
        TMP: customTempDir,
        // Point Python's webbrowser module to our no-op exe so it never falls
        // back to os.startfile() (which opens Chrome/Edge regardless of env vars).
        ...(noopBrowserExe ? { BROWSER: noopBrowserExe } : {})
      }
    });

    // Start active cleanup for voice-changer-native-client binary inside isolated temp dir.
    // The python backend runs GPUDeviceManager/AudioDeviceManager initialization taking ~7 seconds,
    // which gives this poller a large buffer to find and remove the binary before it is spawned.
    let pollCount = 0;
    const maxPolls = 600; // 60 seconds timeout
    const interval = setInterval(() => {
      pollCount++;
      if (pollCount > maxPolls || isShuttingDown) {
        clearInterval(interval);
        return;
      }

      try {
        const files = fs.readdirSync(customTempDir);
        for (const file of files) {
          if (file.startsWith('_MEI')) {
            const meiDir = path.join(customTempDir, file);
            const nativeClientExe = path.join(meiDir, 'native_client', 'voice-changer-native-client.exe');
            const nativeClientApp = path.join(meiDir, 'native_client', 'voice-changer-native-client.app', 'Contents', 'MacOS', 'voice-changer-native-client');
            
            [nativeClientExe, nativeClientApp].forEach(targetPath => {
              if (fs.existsSync(targetPath)) {
                try {
                  const stats = fs.statSync(targetPath);
                  if (stats.size > 20480) { // Only replace if it is the large binary (> 20KB)
                    if (silentWaitExe && fs.existsSync(silentWaitExe)) {
                      fs.copyFileSync(silentWaitExe, targetPath);
                      console.log(`Successfully intercepted and replaced native client: ${targetPath}`);
                    } else {
                      // Fallback to truncation if compilation failed
                      fs.writeFileSync(targetPath, '');
                      console.log(`Successfully intercepted and truncated native client (fallback): ${targetPath}`);
                    }
                  }
                } catch (e) {
                  // Ignore errors, we will retry on next tick
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('Error polling custom temp dir:', err.message);
      }
    }, 100);

    backend.on('error', (err) => {
      console.error('Failed to start backend:', err.message);
      if (!isShuttingDown) {
        console.log('Retrying in 3 seconds...');
        backendRestartTimer = setTimeout(() => startBackend(noopBrowserExe), 3000);
      }
    });

    backend.on('exit', (code, signal) => {
      if (!isShuttingDown) {
        console.log('Backend process exited, restarting in 3 seconds...');
        backendRestartTimer = setTimeout(() => startBackend(noopBrowserExe), 3000);
      }
    });
  }

  // Backend is now started after resource validation inside app.whenReady

  function shutdown() {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    // Cancel any pending backend restart timer so it cannot fire after shutdown
    if (backendRestartTimer) {
      clearTimeout(backendRestartTimer);
      backendRestartTimer = null;
    }

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
    // GUARD: Never create more than one main window
    if (mainWin !== null && !mainWin.isDestroyed()) {
      console.log('Window already exists — focusing existing window instead of creating a new one.');
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
      return mainWin;
    }

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

    // Track the main window reference; clear it when closed
    mainWin = win;
    win.on('closed', () => { mainWin = null; });

    // Capture console logs from the webview in test mode only
    if (testMode) {
      win.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const logMsg = `[LEVEL ${level}] ${message} (at ${path.basename(sourceId)}:${line})\n`;
        fs.appendFileSync(path.join(__dirname, 'console_logs.txt'), logMsg);
      });
    }

    function checkBackendReady(callback) {
      const req = http.get('http://127.0.0.1:18000', (res) => {
        callback(true);
      });
      req.on('error', () => {
        callback(false);
      });
      req.setTimeout(800, () => {
        req.destroy();
        callback(false);
      });
      req.end();
    }

    let testTriggered = false;

    function loadApp() {
      if (win.isDestroyed()) return;

      // First load the local loading screen
      win.loadFile(path.join(__dirname, 'loading.html')).then(() => {
        let pingInterval;
        let checkCount = 0;
        const maxChecks = 120; // 60 seconds max

        pingInterval = setInterval(() => {
          if (win.isDestroyed()) {
            clearInterval(pingInterval);
            return;
          }

          checkCount++;
          checkBackendReady((isReady) => {
            if (isReady) {
              clearInterval(pingInterval);
              // Trigger final visual transition on the loading screen
              win.webContents.executeJavaScript('if (typeof window.setComplete === "function") window.setComplete();')
                .catch(() => {});
              
              // Give the progress bar animation time to fill to 100% and fade the card out
              setTimeout(() => {
                if (win.isDestroyed()) return;
                win.loadURL('http://127.0.0.1:18000').then(() => {
                  console.log('Successfully loaded URL: http://127.0.0.1:18000');
                  if (testMode && !testTriggered) {
                    testTriggered = true;
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
                  console.error('Failed to load URL after backend ready:', err.message);
                });
              }, 850);
            } else if (checkCount >= maxChecks) {
              clearInterval(pingInterval);
              console.error('Max retries reached. Unable to connect to backend.');
              if (testMode) {
                process.exit(1);
              }
              if (!win.isDestroyed()) {
                win.loadURL('data:text/html,<h1>Unable to connect to Voice Changer backend</h1><p>Please ensure the backend is running on port 18000.</p>');
              }
            }
          });
        }, 500); // Check every 500ms
      }).catch((err) => {
        console.error('Failed to load loading.html:', err.message);
        // Fallback directly to the backend URL if loading.html fails to load
        win.loadURL('http://127.0.0.1:18000').catch(() => {});
      });
    }

    loadApp();

    return win;
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // A second instance tried to launch — focus our existing window instead
    if (mainWin && !mainWin.isDestroyed()) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await checkAndDownloadResources();
      // Build the noop-browser.exe that suppresses Python's webbrowser.open() call.
      // Must happen before startBackend() so the env var is ready.
      const noopBrowserExe = ensureNoopBrowserExe();
      startBackend(noopBrowserExe);
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (err) {
      console.error('Failed to initialize resources:', err.message);
      app.quit();
    }
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
