const uNAN = "[^\\p{L}\\p{N}]"; // Unicode non-alphanumeric

function extractLanguage(filename) {
  // Mapping of language codes to standardized format
  const languageMap = {
    // Czech variations - prioritizing these as requested
    CZECH: "CZ",
    CZ: "CZ",
    CZE: "CZ",
    CS: "CZ",
    CES: "CZ",
    ČEŠTINA: "CZ",
    ČESKY: "CZ",
    CESTINA: "CZ",
    CESKY: "CZ",

    // English variations
    EN: "EN",
    ENG: "EN",

    // Slovak variations
    SLOVAK: "SK",
    SLOVENSKY: "SK",
    SK: "SK",
    SLO: "SK",
    SLK: "SK",
    SLOVENČINA: "SK",
    SLOVENCINA: "SK",
  };

  // Split language codes into short (2-3 chars) and long codes for more precise matching
  const langCodes = Object.keys(languageMap).sort(
    (a, b) => b.length - a.length,
  );

  // First check for subtitle patterns - these take priority
  const subtitleKeywords = ["tit", "titulky", "subs", "sub"];
  const audioKeywords = ["audio", "dabing", "dab", "dubbing", "dub"];

  // Unified patterns array for all language-detecting regexes, each using capturing groups
  // Use non-alphanumeric boundaries to avoid false positives and ensure correct matches
  const patterns = {
    // Subtitle keywords with language (e.g., titulky CZ, CZ titulky) fully isolated by non-alphanumeric characters
    subtitleRegex: new RegExp(
      `(?:^|${uNAN})(?:${subtitleKeywords.join("|")})${uNAN}+(${langCodes.join("|")})(?:${uNAN}|$)` + //subtitle keyword + one or more non-alphanumeric characters + language code
        `|(?:^|${uNAN})(${langCodes.join("|")})${uNAN}+(?:${subtitleKeywords.join("|")})(?:${uNAN}|$)`, //language code + one or more non-alphanumeric characters + subtitle keyword
      "giu",
    ),
    // Concatenated format (e.g., CSsub, CZtit) - directly add titulky for matches
    concatenatedSubtitleRegex: new RegExp(
      `(${langCodes.join("|")})(?:${subtitleKeywords.join("|")})` + //language code + subtitle keyword
        `|(?:${subtitleKeywords.join("|")})(${langCodes.join("|")})`, //subtitle keyword + language code
      "gi",
    ),
    //generalReges, language codes...
    generalRegex: new RegExp(
      `(?:^|${uNAN})(${langCodes.join("|")})(?=${uNAN}|$)` + //...must be entirely isolated by non-alphanumeric characters
        `|(${langCodes.join("|")})(?:${audioKeywords.join("|")})`, //...or must be followed by audio keywords
      "giu",
    ),
  };

  //
  // Store all found languages
  const foundLanguages = new Set();
  const subtitleLangs = new Set();

  // Try to match each pattern and collect all language codes from capturing groups
  for (const [patternName, pattern] of Object.entries(patterns)) {
    const matches = [...filename.matchAll(pattern)];
    for (const match of matches) {
      for (let i = 1; i < match.length; i++) {
        const lang = match[i] ? match[i].toUpperCase() : null;
        if (lang && languageMap[lang]) {
          // If this is the subtitle/audio pattern (index 0), check for subtitle keyword
          if (
            patternName === "subtitleRegex" ||
            patternName === "concatenatedSubtitleRegex"
          ) {
            const matchStr = match[0].toLowerCase();
            const hasSubtitleKeyword = subtitleKeywords.some((kw) =>
              matchStr.includes(kw),
            );
            if (hasSubtitleKeyword) {
              foundLanguages.add(`${languageMap[lang]} titulky`);
              subtitleLangs.add(languageMap[lang]);
              continue;
            }
          }

          // Only add plain language code if not already marked as 'titulky'
          if (!subtitleLangs.has(languageMap[lang])) {
            foundLanguages.add(languageMap[lang]);
          }
        }
      }
    }
  }

  // Return all found languages joined by "|" or null if none found
  return foundLanguages.size > 0
    ? Array.from(foundLanguages).sort().join("|")
    : null;
}

function extractSeasonEpisode(filename) {
  // Handle 01x01 (001) with any non-alphanumeric characters as separators
  const standardRegex = new RegExp(
    `(?:^|${uNAN})(?:(?:s|season\\s*)(\\d{1,2})${uNAN}*(?:e|ep|episode\\s*)(\\d{1,3})` + //e.g. S01E01
      `|(\\d{1,2})(?!${uNAN}x26[456])${uNAN}*(?:x|×)${uNAN}*(\\d{1,3}))(?:${uNAN}|$)`, //e.g. 01 x 01, ignores a codec that might look like a episode (e.g. `audio 5.1 x264`)
    "iu",
  );

  // Handle episode-only and part-based formats with unified regex
  // Matches: e01, ep 01, episode 01, #01, part 1, pt 1, part.1, pt.1, etc.
  const episodeOrPartRegex = new RegExp(
    `(?:^|${uNAN})(?:(?:e|ep|episode|#|part|pt)${uNAN}*(\\d{1,3}))(?:${uNAN}|$)`,
    "iu",
  );

  // Try each regex in order of specificity
  let match = filename.match(standardRegex);
  if (match) {
    if (match[1] && match[2]) {
      return {
        season: parseInt(match[1], 10),
        episode: parseInt(match[2], 10),
      };
    } else if (match[3] && match[4]) {
      return {
        season: parseInt(match[3], 10),
        episode: parseInt(match[4], 10),
      };
    }
  }

  match = filename.match(episodeOrPartRegex);
  if (match) {
    return { season: 1, episode: parseInt(match[1], 10) }; // Assume season 1 for episode-only or part-based
  }

  return null; // No match found
}

module.exports = { extractLanguage, extractSeasonEpisode };
