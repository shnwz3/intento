const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const electronBinary = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function getViteCommand() {
    return {
        command: process.execPath,
        args: [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
    };
}

function getElectronCommand() {
    return {
        command: electronBinary,
        args: ['.'],
    };
}

function spawnProcess(command, args, label) {
    const child = spawn(command, args, {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
        shell: false,
    });

    child.on('error', (error) => {
        console.error(`[dev:${label}] Failed to start: ${error.message}`);
    });

    return child;
}

function terminateProcess(child) {
    if (!child || child.killed || !child.pid) {
        return;
    }

    if (isWindows) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
            stdio: 'ignore',
            windowsHide: true,
        });
        killer.on('error', () => {});
        return;
    }

    child.kill('SIGTERM');
}

let viteProcess = null;
let electronProcess = null;
let shuttingDown = false;

function shutdown(code = 0) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    terminateProcess(electronProcess);
    terminateProcess(viteProcess);
    process.exitCode = code;
}

function handleChildExit(label, code, signal) {
    if (shuttingDown) {
        return;
    }

    const normalizedCode = Number.isInteger(code) ? code : 1;
    const reason = signal ? `${label} exited with signal ${signal}` : `${label} exited with code ${normalizedCode}`;
    console.error(`[dev] ${reason}`);
    shutdown(normalizedCode);
}

async function start() {
    const viteCommand = getViteCommand();
    viteProcess = spawnProcess(viteCommand.command, viteCommand.args, 'vite');
    viteProcess.on('exit', (code, signal) => handleChildExit('Vite', code, signal));

    try {
        await waitOn({
            resources: ['http://localhost:5173'],
            timeout: 30000,
            interval: 250,
            tcpTimeout: 1000,
            window: 500,
        });
    } catch (error) {
        console.error(`[dev] Vite server did not become ready: ${error.message}`);
        shutdown(1);
        return;
    }

    if (shuttingDown) {
        return;
    }

    const electronCommand = getElectronCommand();
    electronProcess = spawnProcess(electronCommand.command, electronCommand.args, 'electron');
    electronProcess.on('exit', (code, signal) => handleChildExit('Electron', code, signal));
}

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
    process.on(signal, () => shutdown(0));
});

start().catch((error) => {
    console.error(`[dev] Failed to start development environment: ${error.message}`);
    shutdown(1);
});
