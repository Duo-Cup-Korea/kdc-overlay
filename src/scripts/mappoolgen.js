const fs = require("fs");
const logger = require("winston");
const { v2 } = require("osu-api-extended");

const consolePrefix = "[mappoolgen] ";

const failReasons = ["Failed to fetch data from osu!api", "beatmap md5 provided, not id"];

function isMD5(inputString) {
  return /[a-fA-F0-9]{32}/.test(inputString);
}

async function mappoolgen() {
  const mappoolCSV = fs
    .readFileSync("./mappool.csv", { encoding: "utf8", flag: "r" })
    .trim()
    .split(/\r?\n/);

  let maps = {};
  let mappool = [];

  mappoolCSV.forEach((line) => {
    const spl = line.split(",");

    const code = spl[0].trim();
    const val = spl[1].trim();
    const md5 = isMD5(val);

    maps[code] = {
      code,
      md5: md5 ? val : "",
      id: md5 ? 0 : parseInt(val),
    };
    parseInt(spl[1]);
  });

  for (const code of Object.keys(maps)) {
    const map = maps[code];

    let gotData = false;
    let mapData;

    logger.info(
      consolePrefix +
        `Processing beatmap\t${map.md5 ? map.md5 : ""}${map.id ? map.id : ""}\t(${code})...`
    );

    if (map.id) {
      // Beatmap id routine (using osu!api call)
      try {
        const data = await v2.beatmaps.details({ type: "difficulty", id: map.id });
        gotData = true;
        mapData = {
          map_id: map.id,
          md5: data.checksum,
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
        };
      } catch (err) {
        logger.error(consolePrefix + `While fetching beatmap metadata from osu!api...`);
        logger.error(err.toString());
      }
    }

    if (!gotData || map.md5) {
      logger.warn(
        consolePrefix +
          `Above beatmap's stats are left blank. Reason: ${map.md5 ? failReasons[1] : !gotData ? failReasons[0] : ""}`
      );
      mapData = {
        map_id: map.id,
        md5: map.md5,
        mapset_id: 0,
        code: code,
        background: "",
        cover: "",
        title: "",
        artist: "",
        mapper: "",
        difficulty: "",
        count_circles: 0,
        count_sliders: 0,
        count_spinners: 0,
        stats: {
          cs: 0,
          ar: 0,
          od: 0,
          hp: 0,
          sr: 0,
          bpm: 0,
          length: 0,
        },
      };
    }

    mappool.push(mapData);
  }

  fs.writeFileSync("./mappool.json", JSON.stringify({ mappool }, null, 2));
  logger.info("mappool.json created successfully!");
}

exports = module.exports = { mappoolgen };
