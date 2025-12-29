const needle = require("needle");
const md5 = require("nano-md5");
const sha1 = require("sha1");
const formencode = require("form-urlencoded");
const { filesize } = require("filesize");
const ptt = require("parse-torrent-title");
const { extractSeasonEpisode, extractLanguage } = require("./filenameParser");

const headers = {
  content_type: "application/x-www-form-urlencoded; charset=UTF-8",
  accept: "text/xml; charset=UTF-8",
};

const search = async (query, token) => {
  console.log("Searching", query);
  const data = formencode({
    what: query,
    category: "video",
    limit: 100,
    wst: token,
  });
  const resp = await needle("post", "https://webshare.cz/api/search/", data, {
    headers,
  });
  const files = resp.body.children.filter((el) => el.name == "file");

  return files.map((el) => {
    const ident = el.children.find((el) => el.name == "ident").value;
    const size = el.children.find((el) => el.name == "size").value;
    const posVotes = el.children.find(
      (el) => el.name == "positive_votes",
    ).value;
    const negVotes = el.children.find(
      (el) => el.name == "negative_votes",
    ).value;
    const name = el.children.find((el) => el.name == "name").value;
    const password = el.children.find((el) => el.name == "password");
    const img = el.children.find((el) => el.name == "img")?.value;
    return {
      ident,
      name,
      posVotes,
      negVotes,
      img,
      size: parseInt(size, 10),
      language: extractLanguage(name),
      parsedTitle: ptt.parse(name),
      SeasonEpisode: extractSeasonEpisode(name),
      protected: password && password.value == "1",
    };
  });
};

const saltPassword = async (user, password) => {
  const saltResp = await needle(
    "https://webshare.cz/api/salt/",
    `username_or_email=${user}`,
    headers,
  );
  const salt = saltResp.body.children.find((el) => el.name == "salt").value;
  return sha1(md5.crypt(password, salt));
};

const login = async (user, saltedPassword) => {
  console.log(`Logging in user ${user}`);
  const data = formencode({
    username_or_email: user,
    password: saltedPassword,
    keep_logged_in: 1,
  });
  const resp = await needle(
    "post",
    "https://webshare.cz/api/login/",
    data,
    headers,
  );
  if (
    resp.statusCode != 200 ||
    resp.body.children.find((el) => el.name == "status").value != "OK"
  ) {
    throw Error("Cannot log in to Webshare.cz, invalid login credentials");
  }
  return resp.body.children.find((el) => el.name == "token").value;
};

const getById = async (id, token) => {
  await needle("https://webshare.cz/api/file_info");
  const data = formencode({ ident: id, wst: token });
  const resp = await needle(
    "post",
    "https://webshare.cz/api/file_info/",
    data,
    { headers },
  );
  const children = resp.body.children;

  const size = children.find((el) => el.name == "size").value;
  const posVotes = children.find((el) => el.name == "positive_votes").value;
  const negVotes = children.find((el) => el.name == "negative_votes").value;
  const filename = children.find((el) => el.name == "name").value;
  const desc = children.find((el) => el.name == "description").value;
  const password = children.find((el) => el.name == "password");
  const stripe = children.find((el) => el.name == "stripe")?.value;

  const lang = extractLanguage(filename);
  const parsedTitle = ptt.parse(filename);
  const { title, season, episode } = parsedTitle;
  const seasonEpisode =
    season != null && episode != null
      ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : "";
  const name = `${title || filename} ${seasonEpisode}`;

  const description =
    filename +
    (lang ? `\n🌐 ${lang}` : "") +
    `\n👍 ${posVotes} 👎 ${negVotes}` +
    `\n💾 ${filesize(size)}` +
    `\n${desc}`;

  return {
    ident: id,
    name,
    filename,
    description,
    posVotes,
    negVotes,
    stripe,
    size: parseInt(size, 10),
    language: lang,
    parsedTitle,
    SeasonEpisode: extractSeasonEpisode(name),
    protected: password && password.value == "1",
  };
};

const getUrl = async (ident, token) => {
  const data = formencode({
    ident,
    download_type: "video_stream",
    force_https: 1,
    wst: token,
  });
  const resp = await needle(
    "post",
    "https://webshare.cz/api/file_link/",
    data,
    { headers },
  );
  const status = resp?.body?.children?.find((el) => el.name == "status")?.value;
  if (status == "OK") {
    return resp?.body?.children?.find((el) => el.name == "link")?.value; //url
  } else {
    return null;
  }
};

module.exports = {
  saltPassword,
  login,
  search,
  getById,
  getUrl,
};
