# Webshare Stremio Addon

<img src="src/static/logo.png" height="250px"/>

This addon enables streaming movies and series from Webshare.cz.

The main principles are simplicity and low-maintenance. For this reason there is no video catalog
which would provide high-quality content. This addon works by searching files directly on
webshare.cz. Note this may and does produce incorrect results, but you can usually quickly find the
correct streams.

Feel free to open up issues if you find any issues.

## How can I use it?

This addon is submitted to the community addon catalog. To install, just go Addons -> Community and search for `Webshare.cz`.

Alternative is to follow the link https://20317bf4c6c6-webshare-stremio-addon.baby-beamup.club/ and install from there.

Backup server, in case the official one above does not work, is located at
https://webshare-stremio-addon-fly.fly.dev. Only use it in case the main does not work.

You need to have valid Webshare.cz credentials and a premium account.

## Development

Follow the usual steps:

- install dependencies - `npm install`
- create file `config/keys.js` from template `config/keys.js.sample` and fill in TMDB API key. This
  is not required but some features might require the API key to be present and working.
- install the addon in local stremio instance - `npm start -- --install`

See [Stremion Addon SDK](https://github.com/Stremio/stremio-addon-sdk) for more information.

Code is formatted with [Prettier](https://prettier.io/docs/install). Use `npm run format` to format
the code or `npm run check-formatting` to check for any formatting issues.
