const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { appendFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const DEV_URL = "http://127.0.0.1:3000";
const PROD_PORT = 4010;

let nextServerProcess;
let mainWindow;

function logBoot(message) {
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, "boot.log");
    appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function resolveServerPath() {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(process.resourcesPath, "app", ".next", "standalone-electron", "server.js"),
    path.join(appPath, ".next", "standalone-electron", "server.js"),
    path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js"),
    path.join(appPath, ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "app.asar", ".next", "standalone", "server.js"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

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

  const target = app.isPackaged ? "about:blank" : DEV_URL;
  logBoot(`createWindow target=${target}`);
  void mainWindow.loadURL(target);
  mainWindow.webContents.on("did-finish-load", () => {
    logBoot(`did-finish-load url=${mainWindow?.webContents.getURL() ?? ""}`);
  });
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

  const serverPath = resolveServerPath();
  logBoot(`resolved serverPath=${serverPath}`);
  if (!existsSync(serverPath)) {
    throw new Error(`未找到 Next 服务入口: ${serverPath}`);
  }

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

  nextServerProcess.on("error", (err) => {
    console.error("Failed to start Next server:", err);
    logBoot(`nextServerProcess error=${String(err)}`);
  });

  await waitForServer(`http://127.0.0.1:${PROD_PORT}`, 60000);
}

app.whenReady().then(async () => {
  createWindow();
  try {
    await startProdServer();
    if (mainWindow) {
      const runtimeUrl = `http://127.0.0.1:${PROD_PORT}`;
      logBoot(`loadURL runtime=${runtimeUrl}`);
      await mainWindow.loadURL(runtimeUrl);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Application bootstrap failed:", message);
    logBoot(`bootstrap failed=${message}`);
    if (mainWindow) {
      const safe = message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      await mainWindow.loadURL(`data:text/html;charset=utf-8,
        <html><body style="font-family:Segoe UI;padding:24px;">
          <h2>启动失败</h2>
          <p>本地服务未能启动，请将以下信息反馈给开发者：</p>
          <pre style="white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px;">${safe}</pre>
        </body></html>`);
    }
  }

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
