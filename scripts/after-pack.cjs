// Remove unnecessary locale files from the packaged app
const { readdirSync, rmSync } = require("fs");
const { join } = require("path");

module.exports = async (context) => {
  const localesDir = join(context.appOutDir, "locales");
  try {
    for (const f of readdirSync(localesDir)) {
      if (f !== "zh-CN.pak") rmSync(join(localesDir, f));
    }
  } catch { /* no locales dir */ }
};
