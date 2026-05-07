const { app, BrowserWindow } = require("electron");
const path = require("path");

// Start the server (port auto-assigned by OS)
const { port } = require(path.join(__dirname, "..", "dist", "server.cjs"));

let win;

function createWindow() {
  const http = require("http");

  function open(p) {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      title: "韵易",
      autoHideMenuBar: true,
    });
    win.loadURL(`http://localhost:${p}`);
    win.on("closed", () => (win = null));
  }

  function check(retries = 60) {
    const p = port();
    if (p > 0) {
      http.get(`http://localhost:${p}/`, (res) => {
        if (res.statusCode === 200) open(p);
        else if (retries > 0) setTimeout(() => check(retries - 1), 200);
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
