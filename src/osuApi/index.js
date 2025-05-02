const { v2, auth } = require("osu-api-extended");
const path = require("path");
const logger = require("winston");

const osuApiTokenCachePath = path.join(process.cwd(), "credentials_osuapi.json");

const consolePrefix = "[osu!api] ";

exports = module.exports = function (config) {
  // You need to login only once on application start (auto renew token for v2)
  // https://github.com/cyperdark/osu-api-extended

  async function authenticate() {
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

  authenticate();
};
