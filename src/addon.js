const pkg = require("../package.json");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");
const express = require("express");
const path = require("path");
const webshare = require("./webshare");
const { findShowInfo, findShowInfoInTmdb } = require("./meta");
const landingTemplate = require("./html/landingTemplate");
const { host, url } = require("./env");
const isDev = process.argv.includes("--dev");
const dev = isDev ? "Dev" : "";
// Determine manifest version value early (use timestamp in dev mode)
const versionValue = isDev ? `${pkg.version}-dev-${Date.now()}` : pkg.version;
// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const types = ["movie", "series"];

const manifest = {
  id: "community.coffei.webshare" + dev,
  version: versionValue,
  resources: [
    { name: "stream", types, idPrefixes: ["tt", "coffei.webshare:", "tmdb:"] },
    { name: "catalog", types, idPrefixes: ["coffei.webshare:"] },
    { name: "meta", types, idPrefixes: ["coffei.webshare:"] },
  ],
  types: ["movie", "series"],
  name: "Webshare.cz" + dev,
  description: "Simple webshare.cz search and streaming.",
  catalogs: [
    {
      id: "direct",
      type: "movie",
      name: "Webshare Files",
      extra: [{ name: "search", isRequired: true }],
    },
  ],
  idPrefixes: ["tt", "coffei.webshare:"],
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
    {
      key: "sortMethod",
      type: "select",
      title: "Sort streams by",
      options: ["votes", "filesize", "resolution"],
      default: "votes",
      required: false
    },
  ],
  stremioAddonsConfig: {
    issuer: "https://stremio-addons.net",
    signature:
      "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..mh4jFfQQrEq1Vy-pr9NTkQ.Gp2N-4Mf59lof0OvKVS2m046p7PjhChVHasVT05bGlpwAOiinwU9UX-Yu-8XsisAqYvfJkSJ25EdcOiL-vCMnj_vXRrhxFZQxJKex4_bqeHjdWvyNYJjqUF2oYpZ1XS3.hbgL1AJ03OOLQ0QlKhoy3w",
  },
};

const builder = new addonBuilder(manifest);

const getToken = async (config) => {
  if (config.saltedPassword) {
    return await webshare.login(config.login, config.saltedPassword);
  } else {
    const saltedPassword = await webshare.saltPassword(
      config.login,
      config.password,
    );
    return await webshare.login(config.login, saltedPassword);
  }
};

builder.defineStreamHandler(async function (args) {
  console.log(`🚨 STREAM HANDLER CALLED: ${args.type}/${args.id}`);
  console.log(`🔧 DEBUG CONFIG: args.config =`, JSON.stringify(args.config || {}, null, 2));
  console.log(`🔧 FULL ARGS:`, JSON.stringify(args, null, 2));
  
  try {
    
    if (args.id.startsWith("tt")) {
      const info = await findShowInfo(args.type, args.id);
      if (info) {
        const wsToken = await getToken(args.config || {});
        const sortMethod = (args.config || {}).sortMethod || "votes";
        console.log(`🔍 CONFIG KEYS: ${Object.keys(args.config || {}).join(', ')}`);
        console.log(`🎯 DEBUG: Raw sortMethod = "${(args.config || {}).sortMethod}" → Using = "${sortMethod}"`);
        const streams = await webshare.search(info, wsToken, sortMethod);

        return { streams: streams };
      }
    } else if (args.id.startsWith("coffei.webshare:")) {
      const wsId = args.id.substring(16);
      const wsToken = await getToken(args.config || {});
      return {
        streams: [
          {
            ident: wsId,
            url: url + "getUrl/" + wsId + "?token=" + wsToken,
          },
        ],
      };
    } else if (args.id.startsWith("tmdb:")) {
      const id = args.id.substring(5);
      const info = await findShowInfoInTmdb(args.type, id);
      if (info) {
        const wsToken = await getToken(args.config || {});
        const sortMethod = (args.config || {}).sortMethod || "votes";
        console.log(`🎯 DEBUG TMDB: Using sortMethod = "${sortMethod}"`);
        const streams = await webshare.search(info, wsToken, sortMethod);

        return { streams: streams };
      }
    } else {
      return { streams: [] };
    }
  } catch (error) {
    console.error(
      "Error to get streams: ",
      error.code,
      error.message,
      error.stack,
    );
  }
  return { streams: [] };
});

builder.defineCatalogHandler(async function (args) {
  try {
    const wsToken = await getToken(args.config || {});
    const streams = await webshare.directSearch(args.extra.search, wsToken);
    return {
      metas: streams.map((s) => ({
        id: `coffei.webshare:${s.ident}`,
        name: s.name,
        poster: s.img,
        type: args.type,
      })),
      cacheMaxAge: 60 * 60 * 1000,
    };
  } catch (error) {
    console.error(
      "Error while getting catalog items: ",
      error.code,
      error.message,
      error.stack,
    );
  }
  return { metas: [] };
});

builder.defineMetaHandler(async function (args) {
  try {
    if (args.id.startsWith("coffei.webshare:")) {
      const wsId = args.id.substring(16);
      const wsToken = await getToken(args.config || {});
      const info = await webshare.getById(wsId, wsToken);
      return Promise.resolve({
        meta: {
          id: args.id,
          type: args.type,
          name: info.name,
          poster: info.stripe,
          background: info.stripe,
          description: info.description,
          website: `https://webshare.cz/#/file/${wsId}`,
        },
      });
    } else {
      return Promise.resolve({ meta: {} });
    }
  } catch (error) {
    console.error(
      "Error while getting meta: ",
      error.code,
      error.message,
      error.stack,
    );
  }
  return { meta: {} };
});

const app = express();

// Add the Stremio router for handling addon endpoints - getRouter converts it to express routers
app.use((req, res, next) => {
  console.log(`🌐 REQUEST: ${req.method} ${req.url}`);
  next();
});
app.use(getRouter(builder.getInterface()));

// Add middleware for CORS support
// More comprehensive CORS headers for cross-origin requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control");
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.setHeader("Access-Control-Max-Age", "3600");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

//!!! according to the docs, getRouter should provide landing page, but it doesn't for some reason, so I created a custom landing page routers

// Serve static files from SDK (required for the configuration page)
const sdkPath = path.dirname(require.resolve("stremio-addon-sdk/package.json"));
app.use("/static", express.static(path.join(sdkPath, "static")));
app.use("/mystatic/", express.static(path.join(__dirname, "static")));

// Add middleware to decode FORM requests
app.use(express.urlencoded({ extended: true }));

// Add root route to serve the landing page
app.get(["/configure", "/"], (req, res) => {
  const landingHTML = landingTemplate(manifest);
  res.setHeader("content-type", "text/html");
  res.end(landingHTML);
});

// Finish installation - salt the password and redirect to install/update the plugin
app.post("/configure", async (req, res) => {
  const { login, password, sortMethod } = req.body; // added sortMethod
  let salted;
  let token;
  try {
    salted = await webshare.saltPassword(login, password);
    token = await webshare.login(login, salted);
  } catch (e) {}
  if (token) {
    // Include sortMethod in config object
    const config = { 
      login, 
      saltedPassword: salted,
      sortMethod: sortMethod || "votes" // fallback to default
    };
    const url = `stremio://${host}/${encodeURIComponent(JSON.stringify(config))}/manifest.json`;
    res.redirect(url);
  } else {
    const landingHTML = landingTemplate(manifest, true, { login });
    res.setHeader("content-type", "text/html");
    res.end(landingHTML);
  }
});

// Custom getUrl endpoint
app.get("/getUrl/:ident", async (req, res) => {
  try {
    const ident = req.params.ident;
    const url = await webshare.getUrl(ident, req.query.token);

    const now = new Date();
    // Expires 5 hours from now.
    const expiration = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    res.set("Expires", expiration.toUTCString());
    res.set("Last-Modified", now.toUTCString());
    res.set(
      "Cache-Control",
      "max-age=18000, must-revalidate, proxy-revalidate",
    );

    res.redirect(url);
  } catch (error) {
    console.error("Error in getUrl: ", error.code, error.message, error.stack);
  }
});

module.exports = app;
