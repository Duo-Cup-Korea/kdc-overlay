const path = require("path");
const chokidar = require("chokidar");
const { google } = require("googleapis");
const { v2 } = require("osu-api-extended");
const eaw = require("eastasianwidth");
const logger = require("winston");

const { SlottedSheetsFetcher } = require("./sheetsApi");
const { getRandomInt, get2dValue } = require("../../../utils");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

const interval = 1500;
const consolePrefix = "[Spreadsheets] ";

function getColumnLabels(firstRow) {
  const data = {};
  for (let i = 0; i < firstRow.length; i++) {
    if (firstRow[i].length > 0) data[firstRow[i]] = i;
  }
  return data;
}

class SpreadsheetManager {
  constructor(config, session) {
    this.config = config;
    this.session = session;
    this.matchInfo = [];
    this.allTeams = [];
    this.matchSchedule = ""; // CSL - Keep sheet's schedule separated with actual schedule in session
    this.fetcher = new SlottedSheetsFetcher(sheets, config.sheet);
  }

  async init() {
    this.setup();

    const updateMatchInfoLoop = () => {
      this.updateMatchInfo().then(() => {
        setTimeout(updateMatchInfoLoop, interval + getRandomInt(100));
      });
    };

    updateMatchInfoLoop();
  }

  setup() {
    chokidar.watch(path.join(process.cwd(), "config_stream.yaml")).on("all", () => {
      if (this.session.type === "match") {
        // Fetch match info only when match mode
        this.matchChanged();
      }
    });
  }

  async updateTeams(teams) {
    if (this.session.type !== "match") return;

    const range = "Teams"; // Specifying only the sheet name as range to get the whole cells in the sheet
    const res = await this.fetcher.fetchRange(range);
    const rows = res.values; // Got data from the sheet

    const labels = getColumnLabels(rows[0]);

    const allTeamsData = [];
    const teamsData = new Array(teams.length);

    for (let i = 1; i < rows.length; i++) {
      const teamData = {
        name: rows[i][labels.TeamName],
        acronym: rows[i][labels.Acronym],
        seed: parseInt(rows[i][labels.Seed]),
        players: [
          { id: parseInt(rows[i][labels.uid1]), nick: rows[i][labels.Player1], rank: 0 },
          { id: parseInt(rows[i][labels.uid2]), nick: rows[i][labels.Player2], rank: 0 },
        ],
        comment: rows[i][labels.comment],
      };

      if (!teamData) continue;

      allTeamsData.push(teamData);
      if (teams.includes(parseInt(rows[i][labels.Index])))
        teamsData[teams.indexOf(parseInt(rows[i][labels.Index]))] = teamData;
    }

    for (let i = 0; i < teamsData.length; i++) {
      for (let j = 0; j < 2; j++) {
        if (!teamsData[i].players[j].id) continue;
        logger.verbose(
          consolePrefix + `Querying rank and pp of player id ${teamsData[i].players[j].id}`
        );
        const playerdata = await v2.users.details({
          user: teamsData[i].players[j].id,
          mode: "osu",
          key: "id",
        });
        teamsData[i].players[j].rank = playerdata.statistics.global_rank;
        teamsData[i].players[j].pp = playerdata.statistics.pp;
      }
    }

    this.allTeams = allTeamsData;
    this.session.teams = teamsData;
    this.session.CSL.teams = allTeamsData;
    logger.info(consolePrefix + `Found teams ${teams} on sheet!`);
  }

  async matchChanged() {
    await this.updateMatchInfo(); // Update match info first

    this.session.schedule = this.matchSchedule; // CSL temporal change: timer control - update schedule value with on on sheet only when the matchCode has changed

    const rows = this.matchInfo;

    logger.info(consolePrefix + `Found match <${this.session.match_code}> on sheet!`);
    const teamNums = [
      parseInt(get2dValue.byRange(rows, "N4")),
      parseInt(get2dValue.byRange(rows, "S4")),
    ];
    logger.verbose(consolePrefix + "Going to query teams " + teamNums);

    await this.updateTeams(teamNums);
    await this.updateMappool(this.session.mappool_name);

    const streamTitle = get2dValue.byRange(rows, "W2");
    const titleLen = eaw.length(streamTitle);
    const lines = [];

    lines.push("┌" + "─".repeat(titleLen - 2) + "┐");
    lines.push(streamTitle);
    lines.push("└" + "─".repeat(titleLen - 2) + "┘");

    logger.warn(
      consolePrefix +
        "Stream title generated. Copy & paste the following to your streamer dashboard:\n" +
        lines.join("\n")
    );
    this.session.stream_title = get2dValue.byRange(rows, "W2"); // CSL
  }

  async updateMappool(mappoolName) {
    if (this.session.mappool_manual) return; // Don't get mappool info from the sheet if it is provided manually

    const range = "Mappool"; // Specifying only the sheet name as range to get the whole cells in the sheet
    const res = await this.fetcher.fetchRange(range);
    const rows = res.values; // Got data from the sheet

    const labels = getColumnLabels(rows[0]);

    let mappool = [];

    let gettingMappool = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][labels.RoundCode] === mappoolName) {
        if (!gettingMappool) gettingMappool = true;
      } else if (gettingMappool) {
        // Finished reading current bracket's mappool
        break;
      }

      if (gettingMappool) {
        mappool.push({
          map_id: parseInt(rows[i][labels.map_id]),
          mapset_id: parseInt(rows[i][labels.mapset_id]),
          code: rows[i][labels.Code],
          background: rows[i][labels.background],
          cover: rows[i][labels.cover],
          title: rows[i][labels.title],
          artist: rows[i][labels.artist],
          mapper: rows[i][labels.mapper],
          difficulty: rows[i][labels.difficulty],
          stats: {
            cs: parseFloat(rows[i][labels.cs]),
            ar: parseFloat(rows[i][labels.ar]),
            od: parseFloat(rows[i][labels.od]),
            hp: parseFloat(rows[i][labels.hp]),
            sr: parseFloat(rows[i][labels.sr]),
            bpm: parseFloat(rows[i][labels.bpm]),
            length: parseFloat(rows[i][labels.length]),
          },
        });
      }
    }

    if (mappool.length) {
      this.session.mappool = mappool;
      logger.info(
        consolePrefix + `Found mappool <${mappoolName}> (size: ${mappool.length}) on sheet!`
      );
    }
  }

  async updateMatchInfo() {
    if (this.session.type !== "match") return; // Not accessing the sheet if not in match mode

    const range = this.session.match_code; // Specifying only the sheet name (which is same with the match code) as range to get the whole cells in the sheet
    const res = await this.fetcher.fetchRange(range);

    const rows = res.values; // Got data from the sheet

    this.matchInfo = rows;

    this.session.bracket = get2dValue.byRange(rows, "W7");
    this.session.mappool_name = get2dValue.byRange(rows, "G2");
    this.session.bo = parseInt(get2dValue.byRange(rows, "W4"));
    this.session.schedule = get2dValue.byRange(rows, "W3");

    // Get Match Progress Data
    const progressData = get2dValue.byRange(rows, "B2:C");

    this.session.progress.phase = parseInt(progressData[0][1]);
    this.session.progress.phases[0].first_pick = parseInt(progressData[2][1]);
    this.session.progress.phases[1].first_pick = parseInt(progressData[3][1]);

    let order = [];
    let phase = 0;
    for (let i = 4; i < progressData.length; i++) {
      if (!progressData[i][1]) {
        // Stop reading if empty
        break;
      }

      const pick = JSON.parse(progressData[i][1]);

      if (progressData[i][0].startsWith("phase_")) {
        // change phase
        phase = parseInt(progressData[i][0].substring(6)) - 1;
        order.push([]);
      }

      if (!(pick.pick === -1 && pick.team === -1)) {
        // pass if invalid pick
        order[phase].push(pick);
      }
    }

    order[order.length - 1].pop(); // last map is TB

    for (let i = 0; i < order.length; i++) {
      // apply to session
      this.session.progress.phases[i].order = order[i];
    }
  }
}

exports = module.exports = { SpreadsheetManager };
