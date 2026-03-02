const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

const DEV_URL = "http://127.0.0.1:3000";
const PROD_PORT = 4010;

let nextServerProcess;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#eef3ff",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const target = app.isPackaged ? `http://127.0.0.1:${PROD_PORT}` : DEV_URL;
  void mainWindow.loadURL(target);
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return;
      }
    } catch {
      // keep retrying
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("Next server did not start in time.");
}

async function startProdServer() {
  if (!app.isPackaged) {
    return;
  }

  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, ".next", "standalone", "server.js");

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      PORT: String(PROD_PORT),
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
  });

  nextServerProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`Next server exited with code ${code}`);
    }
  });

  await waitForServer(`http://127.0.0.1:${PROD_PORT}`);
}

app.whenReady().then(async () => {
  await startProdServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (nextServerProcess && !nextServerProcess.killed) {
    nextServerProcess.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
