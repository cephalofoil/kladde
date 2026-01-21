const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const { fork } = require("child_process");

const isDev = !app.isPackaged;
const devServerUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
const prodPort = process.env.PORT || "3000";

let mainWindow;
let nextServer;

const getAppRoot = () =>
  isDev ? path.join(__dirname, "..") : path.join(process.resourcesPath, "app");

const waitForUrl = (url, attempts = 30, delayMs = 300) =>
  new Promise((resolve, reject) => {
    let remaining = attempts;

    const scheduleRetry = () => {
      remaining -= 1;
      if (remaining <= 0) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tryRequest, delayMs);
    };

    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        scheduleRetry();
      });

      request.on("error", scheduleRetry);
    };

    tryRequest();
  });

const startNextServer = async () => {
  if (isDev) {
    return;
  }

  const appRoot = getAppRoot();
  const serverPath = path.join(appRoot, ".next", "standalone", "server.js");

  nextServer = fork(serverPath, [], {
    cwd: appRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: prodPort,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  await waitForUrl(`http://127.0.0.1:${prodPort}`);
};

const createWindow = () => {
  const startUrl = isDev ? devServerUrl : `http://127.0.0.1:${prodPort}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b0b0b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(startUrl)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(startUrl)) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.loadURL(startUrl);
};

app.whenReady().then(async () => {
  await startNextServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextServer) {
    nextServer.kill("SIGTERM");
  }
});
