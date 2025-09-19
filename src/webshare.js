const needle = require("needle");
const md5 = require("nano-md5");
const sha1 = require("sha1");
const formencode = require("form-urlencoded");
const { filesize } = require("filesize");
const ptt = require("parse-torrent-title");
const stringSimilarity = require("string-similarity");
const { extractSeasonEpisode, extractLanguage } = require("./filenameParser");
const { url } = require("./env");

const headers = {
  content_type: "application/x-www-form-urlencoded; charset=UTF-8",
  accept: "text/xml; charset=UTF-8",
};

const normalizeText = (text) =>
  text
    ?.trim()
    ?.toLowerCase()
    .normalize("NFD") // "pelíšky" → "pelisky\u0301"
    .replace(/[\u0300-\u036f]/g, ""); // "pelisky\u0301" → "pelisky"

  // Convert bitrate (in bits per second) into a recommended minimal download speed string
  function formatRequiredSpeed(bitrate, safety = 1.2) {
    if (!bitrate) return null;
    // bitrate is in bits per second, convert to Mbps
    const mbps = (Number(bitrate) / 1_000_000) * safety; // apply safety multiplier
    // round to one decimal place
    const rounded = Math.round(mbps * 10) / 10;
    return `${rounded} Mbps`;
  }

  // Estimate minimum speed based on file size (fallback when bitrate not available)
  function estimateSpeedFromSize(sizeBytes) {
    // Rough estimate: assume typical compression ratio for different quality levels
    // These are conservative estimates
    if (sizeBytes > 8000000000) return "25 Mbps"; // 4K/very high quality
    if (sizeBytes > 4000000000) return "15 Mbps"; // 1080p high quality
    if (sizeBytes > 2000000000) return "10 Mbps"; // 1080p standard
    if (sizeBytes > 1000000000) return "8 Mbps";  // 720p high quality
    if (sizeBytes > 500000000) return "5 Mbps";   // 720p standard / 480p high
    if (sizeBytes > 200000000) return "3 Mbps";   // 480p standard
    return "2 Mbps"; // SD/low quality
  }

  // Determine resolution fallback with 3-level priority:
  // 1. Filename patterns -> 2. API response data -> 3. File size estimation
  function determineResolutionFallback(filename, sizeBytes, apiWidth = null, apiHeight = null) {
    const name = filename.toLowerCase();
    
    // LEVEL 1: Check for common resolution indicators in filename (highest priority)
    if (name.includes('2160p') || name.includes('4k') || name.includes('uhd')) return '2160p';
    if (name.includes('1440p')) return '1440p';
    if (name.includes('1080p') || name.includes('fhd')) return '1080p';
    if (name.includes('720p') || name.includes('hd')) return '720p';
    if (name.includes('480p')) return '480p';
    if (name.includes('360p')) return '360p';
    
    // Check for custom resolution patterns like 432x240
    const resolutionMatch = name.match(/(\d{3,4})x(\d{3,4})/);
    if (resolutionMatch) {
      return `${resolutionMatch[1]}x${resolutionMatch[2]}`;
    }
    
    // LEVEL 2: Use API response data if available (medium priority)
    if (apiWidth && apiHeight) {
      if (apiHeight >= 2160) return '2160p';
      if (apiHeight >= 1440) return '1440p';
      if (apiHeight >= 1080) return '1080p';
      if (apiHeight >= 720) return '720p';
      if (apiHeight >= 480) return '480p';
      if (apiHeight >= 360) return '360p';
      // For custom resolutions from API
      return `${apiWidth}x${apiHeight}`;
    }
    
    // LEVEL 3: Fallback based on file size (lowest priority)
    if (sizeBytes > 8000000000) return '2160p';
    if (sizeBytes > 3000000000) return '1080p';
    if (sizeBytes > 1500000000) return '720p';
    if (sizeBytes > 500000000) return '480p';
    return 'SD';
  }

// Helper function to get resolution priority for sorting (higher number = better)
function getResolutionPriority(resolution) {
  if (!resolution) return 0;
  const res = resolution.toLowerCase();
  if (res.includes('2160p') || res.includes('4k')) return 10;
  if (res.includes('1440p')) return 9;
  if (res.includes('1080p')) return 8;
  if (res.includes('720p')) return 7;
  if (res.includes('480p')) return 6;
  if (res.includes('360p')) return 5;
  // Custom resolutions by height
  const customMatch = res.match(/(\d+)x(\d+)/);
  if (customMatch) {
    const height = parseInt(customMatch[2]);
    if (height >= 2160) return 10;
    if (height >= 1440) return 9;
    if (height >= 1080) return 8;
    if (height >= 720) return 7;
    if (height >= 480) return 6;
    if (height >= 360) return 5;
    return 4;
  }
    return 'SD';
  }

// Helper function to get resolution priority for sorting (higher number = better)
function getResolutionPriority(resolution) {
  if (!resolution) return 0;
  const res = resolution.toLowerCase();
  if (res.includes('2160p') || res.includes('4k')) return 10;
  if (res.includes('1440p')) return 9;
  if (res.includes('1080p')) return 8;
  if (res.includes('720p')) return 7;
  if (res.includes('480p')) return 6;
  if (res.includes('360p')) return 5;
  // Custom resolutions by height
  const customMatch = res.match(/(\d+)x(\d+)/);
  if (customMatch) {
    const height = parseInt(customMatch[2]);
    if (height >= 2160) return 10;
    if (height >= 1440) return 9;
    if (height >= 1080) return 8;
    if (height >= 720) return 7;
    if (height >= 480) return 6;
    if (height >= 360) return 5;
    return 4;
  }
  return 1; // SD or unknown
}

const getQueries = (info) => {
  const names = Array.from(
    new Set(
      [info.name, info.nameSk, info.nameEn, info.originalName].filter((n) => n),
    ),
  );
  if (info.type == "series") {
    return names.flatMap((name) => {
      const series = info.series.padStart(2, "0");
      const episode = info.episode.padStart(2, "0");
      return [`${name} S${series}E${episode}`, `${name} ${series}x${episode}`];
    });
  } else {
    return names;
  }
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

const webshare = {
  saltPassword: async (user, password) => {
    const saltResp = await needle(
      "https://webshare.cz/api/salt/",
      `username_or_email=${user}`,
      headers,
    );
    const salt = saltResp.body.children.find((el) => el.name == "salt").value;
    return sha1(md5.crypt(password, salt));
  },
  login: async (user, saltedPassword) => {
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
      !resp || 
      resp.statusCode != 200 ||
      !resp.body || 
      !resp.body.children ||
      resp.body.children.find((el) => el.name == "status")?.value != "OK"
    ) {
      throw Error("Cannot log in to Webshare.cz, invalid login credentials");
    }
    return resp.body.children.find((el) => el.name == "token")?.value;
  },

  directSearch: async (query, token) => {
    return await search(query, token);
  },

  getById: async (id, token) => {
    const data = formencode({ ident: id, wst: token });
    const resp = await needle(
      "post",
      "https://webshare.cz/api/file_info/",
      data,
      { headers },
    );
    
    // Check if response is valid
    if (!resp || !resp.body || !resp.body.children) {
      console.log(`getById failed for ${id}: Invalid response structure`);
      return null;
    }
    
    const children = resp.body.children;

    // Check if status is OK
    const status = children.find((el) => el.name == "status");
    if (!status || status.value !== "OK") {
      console.log(`getById failed for ${id}: Status not OK`);
      return null;
    }

    const size = children.find((el) => el.name == "size")?.value;
    const posVotes = children.find((el) => el.name == "positive_votes")?.value;
    const negVotes = children.find((el) => el.name == "negative_votes")?.value;
    const filename = children.find((el) => el.name == "name")?.value;
    const desc = children.find((el) => el.name == "description")?.value;
    const password = children.find((el) => el.name == "password");
    const stripe = children.find((el) => el.name == "stripe")?.value;
    // These fields may not be present in all files
    const bitrate = children.find((el) => el.name == "bitrate")?.value;
    const width = children.find((el) => el.name == "width")?.value;
    const height = children.find((el) => el.name == "height")?.value;
    //Leave for future use (some streams end up with "Playback error, please try again.")
    //const fps = children.find((el) => el.name == "fps")?.value;
    //const format = children.find((el) => el.name == "format")?.value;

    // Safety check for required fields
    if (!filename || !size) {
      console.log(`getById failed for ${id}: Missing required fields`);
      return null;
    }

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
      `\n👍 ${posVotes || 0} 👎 ${negVotes || 0}` +
      `\n💾 ${filesize(parseInt(size) || 0)}` +
      `\n${desc || ""}`;

    return {
      ident: id,
      name,
      filename,
      description,
      posVotes,
      negVotes,
      stripe,
      size: parseInt(size, 10),
      bitrate: bitrate ? parseInt(bitrate, 10) : null,
      width: width ? parseInt(width, 10) : null,
      height: height ? parseInt(height, 10) : null,
      //Leave for future use (some streams end up with "Playback error, please try again.")
      //fps: fps || null,
      //format: format || null,
      language: lang,
      parsedTitle,
      SeasonEpisode: extractSeasonEpisode(name),
      protected: password && password.value == "1",
    };
  },

  // improve movie query by adding year with movies
  // search localized names too
  // we could also combine multiple different queries to get better results
  search: async (showInfo, token, sortMethod = "votes") => {
    const searchStart = Date.now();
    console.log(`⏱️ PERFORMANCE: Starting search for "${showInfo.name || showInfo.nameSk}" (${showInfo.type})`);
    
    const queries = getQueries(showInfo);
    // Get all results from different queries - but do them sequentially to avoid ECONNRESET
    let results = [];
    for (let i = 0; i < queries.length; i++) {
      try {
        const queryResult = await search(queries[i], token);
        results.push(queryResult);
        
        // Add small delay between queries to prevent API overload
        if (i < queries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between queries
        }
      } catch (error) {
        console.log(`Query failed for "${queries[i]}":`, error.message);
        results.push([]); // Add empty array to maintain index consistency
      }
    }

    // Create a unique list by using an object to track items by their ident
    results = Object.values(
      results.flat().reduce((acc, item) => {
        acc[item.ident] = item;
        return acc;
      }, {}),
    );

    // Map basic items first
    let mapped = results.map((item) => {
          //if there is parsed year of release for found stream, add it to comparison to have better sorting results
          const titleYear =
            showInfo.type === "movie" &&
            item.parsedTitle.year &&
            showInfo.year &&
            !ptt.parse(queries[0]).year
              ? `${showInfo.year}`
              : ""; //if there is year in title, do not compare years e.g. Wonder Woman 1984 (2020)
          const queryTitleYear =
            showInfo.type === "movie" &&
            item.parsedTitle.year &&
            showInfo.year &&
            !ptt.parse(queries[0]).year
              ? `${item.parsedTitle.year}`
              : "";

          const cleanedTitle =
            normalizeText(
              item.parsedTitle.title
                ?.replace(/subtitles/gi, "")
                ?.replace(/titulky/gi, "")
                ?.replace(/[^\p{L}\p{N}\s]/gu, " ") //remove special chars but keep accented letters like áíéř
                ?.replace(/[_]/g, " "),
            ) + titleYear;

          const cleanedName = normalizeText(
            item.name
              ?.replace(/subtitles/gi, "")
              ?.replace(/titulky/gi, "")
              ?.replace(/[^\p{L}\p{N}\s]/gu, " ") //remove special chars but keep accented letters like áíéř
              ?.replace(/[_]/g, " "),
          );

          const queryTitle = normalizeText(
            showInfo.type == "series"
              ? queries[0]?.split(" ").slice(0, -1).join(" ")
              : queries[0] + queryTitleYear,
          );

          const queryTitleSk = normalizeText(
            showInfo.type == "series"
              ? queries[1]?.split(" ").slice(0, -1).join(" ")
              : queries[1] + queryTitleYear,
          );

          const queryTitleOriginal = normalizeText(
            showInfo.type == "series"
              ? queries[2]?.split(" ").slice(0, -1).join(" ")
              : queries[2] + queryTitleYear,
          );

          const matchQueries = [
            queryTitle,
            queryTitleOriginal,
            queryTitleSk,
            queryTitleSk &&
              queryTitleOriginal &&
              queryTitleSk + "/" + queryTitleOriginal,
            queryTitle &&
              queryTitleOriginal &&
              queryTitle + "/" + queryTitleOriginal,
          ].filter((q) => q);

          const titleMatch = stringSimilarity.findBestMatch(
            cleanedTitle,
            matchQueries,
          ).bestMatch.rating;

          const nameMatch = stringSimilarity.findBestMatch(
            cleanedName,
            matchQueries,
          ).bestMatch.rating;

          // this threshold has best results, it filters out the most irrelevant streams
          const strongMatch = titleMatch > 0.5;

          return {
            ident: item.ident,
            titleYear: titleYear,
            queryTitleYear: queryTitleYear,
            url: url + "getUrl/" + item.ident + "?token=" + token,
            description: (() => {
              let desc = item.name + (item.language ? `\n🌐 ${item.language}` : "") +
                `\n👍 ${item.posVotes} 👎 ${item.negVotes}` +
                `\n💾 ${filesize(item.size)}`;
              // (min-speed text removed) — keep bitrate available on the item for later enrichment/use
              return desc;
            })(),
            match: titleMatch,
            strongMatch,
            // round to the precision of 1 decimal point, for sorting purposes lower
            fulltextMatch: Math.round(nameMatch * 10) / 10,
            // this allows other lower quality results, useful for titles where parse-torrent-title parses the title incorrectly
            weakMatch: nameMatch > 0.3,
            SeasonEpisode: item.SeasonEpisode,
            posVotes: parseInt(item.posVotes, 10) || 0,
            fileSize: item.size, // keep original size for sorting
            // add a check-mark if we get a strong match based on the parsed filename (name will be updated after enrichment)
            name: `Webshare${strongMatch ? " ✅" : ""}`,
            behaviorHints: {
              bingeGroup:
                "WebshareStremio|" +
                item.language +
                "|" +
                item.parsedTitle.resolution +
                "|" +
                item.parsedTitle.source, //secures quite reliable auto play next episode
                                      //
              videoSize: item.size, //for subtitle addons
              filename: item.name, //for subtitle addons
            },

            queries: [queryTitle, queryTitleOriginal, queryTitleSk],
            parsedTitle: cleanedTitle,
            // Initialize resolution using 3-level fallback: filename -> API -> file size
            resolution: determineResolutionFallback(item.name, item.size, null, null),
          };
        });

    // Apply basic fallback logic to ALL mapped items to ensure every file has resolution and speed (before filtering/sorting)
    mapped.forEach(target => {
      // Ensure every file has some resolution displayed using basic fallback (filename + size only)
      if (!target.resolution) {
        target.resolution = determineResolutionFallback(target.description, target.fileSize, null, null);
      }
      
      // Update name field to show basic resolution
      target.name = `Webshare${target.strongMatch ? " ✅" : ""} ${target.resolution || ""}`;
      
      // Add basic speed estimation from file size (no enrichment yet)
      if (!target.description.includes('⚡')) {
        const speedHint = estimateSpeedFromSize(target.fileSize);
        if (speedHint) {
          target.description = target.description + `\n⚡ ${speedHint}`;
        }
      }
    });


    const filteredItems = mapped
        // Filter out items with low match score, exclude TV episodes when searching for movies,
        // exclude protected files, and ensure series match the correct season/episode
        .filter(
          (item) =>
            !item.protected &&
            (item.strongMatch || item.weakMatch) &&
            item.queryTitleYear == item.titleYear && //filters out movies, which we are sure, that should not be send to Stremio
            !(
              showInfo.type == "movie" &&
              item.SeasonEpisode &&
              !item.name.toLowerCase().includes("part") //some movies can have parts, e.g. "The Dark Knight Part 2", which would lead to exclusion of correct streams
            ) && //if movie, remove series streams from movie results
            !(
              showInfo.type == "series" &&
              (item.SeasonEpisode?.season != showInfo.series ||
                item.SeasonEpisode?.episode != showInfo.episode)
            ), //if series, keep only streams with correct season and episode
        )
        .sort((a, b) => {
          console.log(`🎯 SORTING: Using method "${sortMethod}"`);
          
          // FIRST: Always prefer strong matches over weak matches
          if (a.strongMatch && !b.strongMatch) {
            return -1;
          } else if (!a.strongMatch && b.strongMatch) {
            return 1;
          }
          
          // SECOND: Apply sorting method based on user preference
          if (sortMethod === "filesize") {
            // File size priority sorting
            if (a.fileSize != b.fileSize) {
              console.log(`📁 FILESIZE: ${a.ident}(${(a.fileSize/1024/1024/1024).toFixed(2)}GB) vs ${b.ident}(${(b.fileSize/1024/1024/1024).toFixed(2)}GB)`);
              return b.fileSize - a.fileSize;
            }
            if (a.match != b.match) {
              return b.match - a.match;
            }
            if (a.posVotes != b.posVotes) {
              return b.posVotes - a.posVotes;
            }
          } else if (sortMethod === "votes") {
            // Original Coffei implementation - match then votes priority
            if (a.match != b.match) {
              console.log(`🎯 VOTES-MATCH: ${a.ident}(${a.match.toFixed(3)}) vs ${b.ident}(${b.match.toFixed(3)})`);
              return b.match - a.match;
            }
            if (a.posVotes != b.posVotes) {
              console.log(`👍 VOTES: ${a.ident}(${a.posVotes}) vs ${b.ident}(${b.posVotes})`);
              return b.posVotes - a.posVotes;
            }
            if (a.fileSize != b.fileSize) {
              return b.fileSize - a.fileSize;
            }
          } else if (sortMethod === "resolution") {
            // Resolution priority - highest resolution first
            const aPriority = getResolutionPriority(a.resolution);
            const bPriority = getResolutionPriority(b.resolution);
            if (aPriority != bPriority) {
              console.log(`🎬 RESOLUTION: ${a.ident}(${a.resolution}=${aPriority}) vs ${b.ident}(${b.resolution}=${bPriority})`);
              return bPriority - aPriority;
            }
            if (a.match != b.match) {
              return b.match - a.match;
            }
            if (a.fileSize != b.fileSize) {
              return b.fileSize - a.fileSize;
            }
            if (a.posVotes != b.posVotes) {
              return b.posVotes - a.posVotes;
            }
          }
          
          // FALLBACK: Use fulltext match for weak matches
          if (!a.strongMatch && !b.strongMatch && a.fulltextMatch != b.fulltextMatch) {
            return b.fulltextMatch - a.fulltextMatch;
          }
          
          return 0;
        })
        .slice(0, 100);
        
    console.log(`⏱️ PERFORMANCE: After filtering/sorting, got ${filteredItems.length} streams, preparing for enrichment`);
    
    // NOW enrich only the TOP streams that will actually be shown to the user (dynamic amount)
    const topStreamsToEnrich = filteredItems; // Enrich ALL filtered streams since they're the ones shown
    console.log(`⏱️ PERFORMANCE: Enriching ALL ${topStreamsToEnrich.length} final streams (dynamic enrichment)`);
    
    try {
      if (topStreamsToEnrich.length > 0) {
        const enrichmentStart = Date.now();
        
        // Limit concurrent requests to avoid overwhelming the API
        const chunkSize = 15; // Increase chunk size for better performance while maintaining stability
        const chunks = [];
        for (let i = 0; i < topStreamsToEnrich.length; i += chunkSize) {
          chunks.push(topStreamsToEnrich.slice(i, i + chunkSize));
        }

        for (const chunk of chunks) {
          console.log(`⏱️ Enriching chunk of ${chunk.length} TOP streams (chunk ${chunks.indexOf(chunk) + 1}/${chunks.length})`);
          const chunkStart = Date.now();
          
          const chunkDetails = await Promise.all(
            chunk.map(async (stream) => {
              try {
                const details = module.exports.getById ? await module.exports.getById(stream.ident, token) : null;
                return { stream, details };
              } catch (err) {
                console.log(`getById failed for TOP stream ${stream.ident}:`, err.message);
                return { stream, details: null };
              }
            }),
          );
          
          // Apply enrichment to each stream in the chunk
          chunkDetails.forEach(({ stream, details }) => {
            if (details) {
              // attach bitrate and dimensions for display/sorting
              stream.bitrate = details.bitrate || null;
              stream.width = details.width || null;
              stream.height = details.height || null;
              
              // Recalculate resolution using three-level fallback with API data
              stream.resolution = determineResolutionFallback(details.filename || stream.description, stream.fileSize, details.width, details.height);
              
              // Update name field to show correct resolution after enrichment
              stream.name = `Webshare${stream.strongMatch ? " ✅" : ""} ${stream.resolution || ""}`;
              
              // Update speed hint with bitrate if available
              if (stream.bitrate) {
                const speedHint = formatRequiredSpeed(stream.bitrate);
                if (speedHint) {
                  // Replace existing speed estimate with bitrate-based one
                  stream.description = stream.description.replace(/\n⚡ \d+(\.\d+)? Mbps/, `\n⚡ ${speedHint}`);
                }
              }
            }
          });
          
          console.log(`⏱️ TOP streams chunk completed in ${Date.now() - chunkStart}ms`);
          
          // Reduce delay between chunks for better performance
          if (chunks.indexOf(chunk) < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 25)); // Reduced from 50ms to 25ms
          }
        }
        
        const enrichmentEnd = Date.now();
        console.log(`⏱️ PERFORMANCE: TOP streams enrichment completed in ${enrichmentEnd - enrichmentStart}ms total`);
      }
    } catch (e) {
      console.log("TOP streams enrichment error:", e.message);
      // ignore enrichment errors
    }
        
    const searchEnd = Date.now();
    console.log(`⏱️ PERFORMANCE: Search completed in ${searchEnd - searchStart}ms total, returning ${filteredItems.length} streams`);
    
    return filteredItems;
  },

  getUrl: async (ident, token) => {
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
    const status = resp?.body?.children?.find(
      (el) => el.name == "status",
    )?.value;
    if (status == "OK") {
      return resp?.body?.children?.find((el) => el.name == "link")?.value; //url
    } else {
      return null;
    }
  },
};
module.exports = webshare;
