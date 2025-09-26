//Call it like: node .\test\API\POST.file_info.js <ident> [token]

const needle = require('needle');
const webshare = require('../../src/webshare');

async function getFileInfo(ident, token) {
  const data = `ident=${encodeURIComponent(ident)}&wst=${encodeURIComponent(token)}`;
  const resp = await needle('post', 'https://webshare.cz/api/file_info/', data, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', accept: 'text/xml; charset=UTF-8' }
  });
  if (!resp || !resp.body || !resp.body.children) {
    console.error('Unexpected response', resp && resp.body);
    return null;
  }
  const fields = {};
  for (const el of resp.body.children) {
    fields[el.name] = el.value;
  }
  console.log('Fields returned by API:', fields);
  return fields;
}

async function ensureTokenMaybe(providedToken) {
  // If a token was provided, try it first
  if (providedToken) return providedToken;

  // Fallback: try to read LOGIN and PASSWORD from env
  const login = process.env.WS_LOGIN || process.env.LOGIN || null;
  const password = process.env.WS_PASSWORD || process.env.PASSWORD || null;
  if (!login || !password) return null;

  // salt the password and login
  try {
    const salted = await webshare.saltPassword(login, password);
    const token = await webshare.login(login, salted);
    return token;
  } catch (e) {
    console.error('Failed to obtain token via login:', e && e.message);
    return null;
  }
}

async function run() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node test/POSTfile_info.js <ident> [token]');
    console.error('Or set env WS_LOGIN and WS_PASSWORD to have the script acquire a token.');
    process.exit(1);
  }

  const ident = argv[0];
  const providedToken = argv[1] || null;

  let token = await ensureTokenMaybe(providedToken);
  if (!token) {
    console.error('No token provided and could not acquire one from env. Exiting.');
    process.exit(1);
  }

  const fields = await getFileInfo(ident, token);
  if (!fields) {
    console.error('Initial token may be invalid or API returned unexpected payload.');
    // Try to re-acquire token if we had a provided token
    if (providedToken) {
      console.log('Attempting to acquire a fresh token via env LOGIN/PASSWORD...');
      token = await ensureTokenMaybe(null);
      if (!token) {
        console.error('Could not acquire fresh token. Exiting.');
        process.exit(1);
      }
      const fields2 = await getFileInfo(ident, token);
      if (!fields2) {
        console.error('file_info still returned unexpected payload. Exiting.');
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

run().catch((e) => {
  console.error('Unhandled error', e && e.stack);
  process.exit(1);
});