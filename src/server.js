#!/usr/bin/env node

const { publishToCentral } = require("stremio-addon-sdk");
const app = require("./addon");

const port = process.env.PORT || 61613;
app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}/manifest.json`);
});
// serveHTTP(addonInterface, { port: process.env.PORT || 61613 })

// when you've deployed your addon, un-comment this line
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
