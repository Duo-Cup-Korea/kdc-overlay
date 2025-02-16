const { v2, auth } = require("osu-api-extended");

exports = module.exports = function (config) {
  // You need to login only once on application start (auto renew token for v2)
  // https://github.com/cyperdark/osu-api-extended
  async function authenticate() {
    const SCOPE_LIST = ["public"];

    await auth.login(config.clientID, config.clientSecret, SCOPE_LIST);
    const data = await v2.beatmap.id.details(75);
    if (data.beatmapset_id === 1) {
      console.log("osu!api authentication success!");
    } else {
      console.log("osu!api authentication failure");
      console.log(
        "Please check if your client ID and secret you entered in config.js are correct.\n"
      );
    }
  }

  authenticate();
};
