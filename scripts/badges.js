const fs = require("fs");

const players = JSON.parse(
  fs.readFileSync("./players.json", { encoding: "utf8", flag: "r" })
).players;
let textToWrite = "";

for (const nick of Object.keys(players)) {
  const player = players[nick];
  textToWrite += player.username + "\n";
  for (const badge of player.badges) {
    textToWrite += badge["image@2x_url"] + ",";
    textToWrite += badge.description + ",";
    textToWrite += "\n";
  }
  textToWrite += "\n";
}

console.log(textToWrite);
fs.writeFileSync("./badges.csv", textToWrite);
