const { v2, auth } = require("osu-api-extended");
const logger = require("winston");

exports = module.exports = function (config) {
  // You need to login only once on application start (auto renew token for v2)
  // https://github.com/cyperdark/osu-api-extended
  async function authenticate() {
    const SCOPE_LIST = ["public"];

    await auth.login(config.clientID, config.clientSecret, SCOPE_LIST);
    const data = await v2.beatmap.id.details(75);
    if (data.beatmapset_id === 1) {
      logger.info("osu!api authentication success!");
    } else {
      logger.error("osu!api authentication failure");
      logger.error(
        "Please check if your client ID and secret you entered in config.yaml are correct.\n"
      );
    }
  }

  authenticate();
};
