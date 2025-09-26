#!/usr/bin/env node

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  console.error('Promise:', promise);
});

const { publishToCentral } = require("stremio-addon-sdk");
const app = require("./addon");

const port = process.env.PORT || 61613;
app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}/manifest.json`);
});
// serveHTTP(addonInterface, { port: process.env.PORT || 61613 })

// when you've deployed your addon, un-comment this line - for example you can use command "npx cloudflared tunnel --url http://localhost:61613"
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
