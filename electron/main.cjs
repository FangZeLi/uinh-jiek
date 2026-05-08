const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");

let splashWin = null;
let mainWin = null;

function showSplash() {
  splashWin = new BrowserWindow({
    width: 640,
    height: 400,
    frame: false,
    resizable: false,
  });
  splashWin.loadFile(path.join(__dirname, "splash.html"));
}

function createWindow() {
  showSplash();

  const { fork } = require("child_process");
  const serverPath = path.join(__dirname, "..", "dist", "server.cjs");
  const child = fork(serverPath, [], { silent: true });

  let serverPort = 0;
  child.stdout.on("data", (data) => {
    const match = data.toString().match(/localhost:(\d+)/);
    if (match) serverPort = parseInt(match[1]);
  });

  function check(retries = 120) {
    if (serverPort > 0) {
      http.get(`http://localhost:${serverPort}/`, (res) => {
        if (res.statusCode === 200) {
          mainWin = new BrowserWindow({
            width: 1280,
            height: 800,
            title: "韵易",
            autoHideMenuBar: true,
          });
          mainWin.loadURL(`http://localhost:${serverPort}`);
          mainWin.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: "deny" };
          });
          mainWin.on("closed", () => (mainWin = null));
          if (splashWin) { splashWin.close(); splashWin = null; }
        } else if (retries > 0) setTimeout(() => check(retries - 1), 200);
      }).on("error", () => {
        if (retries > 0) setTimeout(() => check(retries - 1), 200);
      });
    } else if (retries > 0) {
      setTimeout(() => check(retries - 1), 200);
    }
  }
  check();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
