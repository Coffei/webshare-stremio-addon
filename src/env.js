const host =
  process.argv.includes("--dev") == 1
    ? "localhost:61613"
    : "20317bf4c6c6-webshare-stremio-addon.baby-beamup.club";

const url =
  process.argv.includes("--dev") == 1
    ? "http://localhost:61613/"
    // for testing on other devices (like androidTV or so...), for example you can use command "npx cloudflared tunnel --url http://localhost:61613" and put the generated url here down
    // Then start the addon without --dev: "node src/server.js"
    : "https://20317bf4c6c6-webshare-stremio-addon.baby-beamup.club/";

module.exports = { host, url };
