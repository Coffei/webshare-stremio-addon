const { addonBuilder } = require("stremio-addon-sdk");
const needle = require("needle");
const webshare = require("./webshare");
const { findShowInfo } = require("./meta");
const dev = process.argv.includes("--dev") == 1 ? "Dev" : "";

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
  id: "community.coffei.webshare" + dev,
  version: "0.2.0",
  catalogs: [],
  resources: ["stream"],
  types: ["movie", "series"],
  name: "Webshare.cz" + dev,
  description: "Simple webshare.cz search and streaming.",
  idPrefixes: ["tt"],
  behaviorHints: { configurable: true, configurationRequired: true },
  config: [
    {
      key: "login",
      type: "text",
      title: "Webshare.cz login - username or email",
      required: true,
    },
    {
      key: "password",
      type: "password",
      title: "Webshare.cz password",
      required: true,
    },
  ],
};
const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async function (args) {
  try {
    const info = await findShowInfo(args.type, args.id);
    if (info) {
      const config = args.config || {};
      const wsToken = await webshare.login(config.login, config.password);
      const streams = await webshare.search(info, wsToken);
      const streamsWithUrl = await webshare.addUrlToStreams(streams, wsToken);

      return { streams: streamsWithUrl };
    }
  } catch (error) {
    console.error("Error: ", error.code, error.message, error.stack);
  }
  return { streams: [] };
});

module.exports = builder.getInterface();
