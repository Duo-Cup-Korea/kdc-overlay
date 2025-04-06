const { v2, auth } = require("osu-api-extended");
const fs = require("fs");

const config = require("../config.js");

const playersCSV = fs
  .readFileSync("./players.csv", { encoding: "utf8", flag: "r" })
  .trim()
  .split(/\r?\n/);

let uids = [];
let players = {};

playersCSV.forEach((line) => {
  const uid = parseInt(line);
  uids.push(uid);
});

const call = async () => {
  const SCOPE_LIST = ["public"];

  // Auth via client
  await auth.login(config.clientID, config.clientSecret, SCOPE_LIST);

  for (let i = 0; i < uids.length; i++) {
    console.log("Requesting user " + uids[i] + "...");
    const data = await v2.users.details({ user: uids[i], mode: "osu", key: "id" });
    players[data.username] = data;
  }
};

call().then(() => {
  console.log({ players });
  fs.writeFileSync("./players.json", JSON.stringify({ players }, null, 2));
});
