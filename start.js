const { spawn, execSync } = require('child_process');
const path = require('path');

// Clean up any previously orphaned main.exe instances to prevent port binding conflicts
if (process.platform === 'win32') {
  try {
    console.log('Cleaning up existing main.exe processes...');
    execSync('taskkill /F /IM main.exe', { stdio: 'ignore' });
  } catch (e) {
    // No existing processes to kill
  }
}

const pythonExe = path.join(__dirname, 'dist', 'main.exe');
const args = ['cui', '--https=false', '--no_cui=True'];

let backend = null;
let isShuttingDown = false;

function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      backend.kill('SIGKILL');
    }
  } catch (err) {
    // Already terminated or permission issue
  }
}

function startBackend() {
  console.log(`Starting Voice Changer Client: ${pythonExe} ${args.join(' ')}`);

  backend = spawn(pythonExe, args, {
    cwd: path.join(__dirname, 'dist'),
    stdio: 'inherit',
    shell: false
  });

  backend.on('error', (err) => {
    console.error('Failed to start backend:', err.message);
    if (!isShuttingDown) {
      console.log('Retrying in 3 seconds...');
      setTimeout(startBackend, 3000);
    }
  });

  backend.on('exit', (code, signal) => {
    if (signal) {
      console.log(`Backend process killed by signal: ${signal}`);
    } else if (code !== 0) {
      console.log(`Backend process exited with code: ${code}`);
    } else {
      console.log('Backend process exited normally');
    }

    if (!isShuttingDown) {
      console.log('Restarting backend in 3 seconds...');
      setTimeout(startBackend, 3000);
    }
  });
}

function shutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log('Terminating Voice Changer...');

  if (backend && !backend.killed) {
    if (process.platform === 'win32') {
      killProcessTree(backend.pid);
      process.exit(0);
    } else {
      backend.kill('SIGTERM');

      setTimeout(() => {
        if (backend && !backend.killed) {
          backend.kill('SIGKILL');
        }
        process.exit(0);
      }, 5000);
    }
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  if (backend && !backend.killed) {
    killProcessTree(backend.pid);
  }
});

startBackend();

