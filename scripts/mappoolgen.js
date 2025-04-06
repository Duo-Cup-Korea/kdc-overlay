const { v2, auth } = require("osu-api-extended");
const fs = require("fs");

const config = require("../config.js");

const mappoolCSV = fs
  .readFileSync("./mappool.csv", { encoding: "utf8", flag: "r" })
  .trim()
  .split(/\r?\n/);
let maps = {};
let mappool = [];

mappoolCSV.forEach((line) => {
  const spl = line.split(",");
  maps[spl[0].trim()] = parseInt(spl[1]);
});

const call = async () => {
  const SCOPE_LIST = ["public"];

  // Auth via client
  await auth.login(config.clientID, config.clientSecret, SCOPE_LIST);

  for (const code of Object.keys(maps)) {
    const data = await v2.beatmaps.details({ type: "difficulty", id: maps[code] });
    mappool.push({
      map_id: maps[code],
      mapset_id: data.beatmapset_id,
      code: code,
      background: `https://assets.ppy.sh/beatmaps/${data.beatmapset_id}/covers/raw.jpg`,
      cover: data.beatmapset.covers["cover@2x"],
      title: data.beatmapset.title,
      artist: data.beatmapset.artist,
      mapper: data.beatmapset.creator,
      difficulty: data.version,
      count_circles: data.count_circles,
      count_sliders: data.count_sliders,
      count_spinners: data.count_spinners,
      stats: {
        cs: data.cs,
        ar: data.ar,
        od: data.accuracy,
        hp: data.drain,
        sr: data.difficulty_rating,
        bpm: data.bpm,
        length: data.total_length * 1000,
      },
    });
  }
};

call().then(() => {
  console.log({ mappool: mappool });
  fs.writeFileSync("./mappool.json", JSON.stringify({ mappool: mappool }, null, 2));
});
