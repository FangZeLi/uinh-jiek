const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

let win;

function createWindow() {
  // Show splash immediately
  win = new BrowserWindow({
    width: 640,
    height: 400,
    frame: false,
    resizable: false,
    title: "韵易",
  });
  win.loadFile(path.join(__dirname, "splash.html"));

  // Fork server in background (non-blocking)
  const { fork } = require("child_process");
  const serverPath = path.join(__dirname, "..", "dist", "server.cjs");
  const child = fork(serverPath, [], { silent: true });

  let serverPort = 0;
  child.stdout.on("data", (data) => {
    const match = data.toString().match(/localhost:(\d+)/);
    if (match) serverPort = parseInt(match[1]);
  });

  // Poll until server ready, then load app
  function check(retries = 120) {
    if (serverPort > 0) {
      http.get(`http://localhost:${serverPort}/`, (res) => {
        if (res.statusCode === 200) {
          win.setSize(1280, 800);
          win.center();
          win.setResizable(true);
          win.setMenuBarVisibility(false);
          win.loadURL(`http://localhost:${serverPort}`);
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
