const { v2, auth } = require("osu-api-extended");
const path = require("path");
const logger = require("winston");

const osuApiTokenCachePath = path.join(process.cwd(), "credentials_osuapi.json");

const consolePrefix = "[osu!api] ";

async function initializeOsuApi(config) {
  try {
    await auth.login({
      type: "v2",
      client_id: config.clientID,
      client_secret: config.clientSecret,
      cachedTokenPath: osuApiTokenCachePath, // path to the file your auth token will be saved (to prevent osu!api spam)
    });

    const result = await v2.users.details({ user: "peppy", mode: "osu", key: "@" });
    if (result?.id === 2) {
      logger.info(consolePrefix + "Authentication success!");
    } else {
      logger.error(consolePrefix + "Authentication failure");
    }
  } catch (error) {
    logger.error(consolePrefix + error);
  }
}

exports = module.exports = { initializeOsuApi };
