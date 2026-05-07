const { app, BrowserWindow } = require("electron");
const path = require("path");

// Show splash window immediately
let win;
app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 640,
    height: 400,
    frame: false,
    resizable: false,
    title: "韵易",
  });
  win.loadFile(path.join(__dirname, "splash.html"));

  // Start server in background
  const { port } = require(path.join(__dirname, "..", "dist", "server.cjs"));

  // Poll server until ready, then load app
  const http = require("http");
  function check(retries = 60) {
    const p = port();
    if (p > 0) {
      http.get(`http://localhost:${p}/`, (res) => {
        if (res.statusCode === 200) {
          win.setSize(1280, 800);
          win.center();
          win.setResizable(true);
          win.setMenuBarVisibility(false);
          win.loadURL(`http://localhost:${p}`);
        } else if (retries > 0) setTimeout(() => check(retries - 1), 200);
      }).on("error", () => {
        if (retries > 0) setTimeout(() => check(retries - 1), 200);
      });
    } else if (retries > 0) {
      setTimeout(() => check(retries - 1), 200);
    }
  }
  check();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
