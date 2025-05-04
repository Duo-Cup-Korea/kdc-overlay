const { w3cwebsocket: WebSocket } = require("websocket");
const { v2 } = require("osu-api-extended");
const path = require("path");
const fs = require("fs");
// eslint-disable-next-line no-unused-vars
const difficultyCalculator = require("../utils/difficultyCalculator");
const logger = require("winston");

const consolePrefix = "[Gosumemory] ";

let gosuWs;
let connected = false;

exports = module.exports = function (config, session) {
  function setupGosuWs() {
    gosuWs = new WebSocket(`ws://${config.gosumemoryHost}:${config.gosumemoryPort}/ws`);

    gosuWs.onopen = () => {
      logger.info(consolePrefix + "Successfully connected to Gosumemory!");
      // connected will be updated onmessage
    };

    gosuWs.onclose = () => {
      logger.info(consolePrefix + "Gosumemory WebSocket connection closed.");
      connected = false;
      setTimeout(setupGosuWs, 1000);
    };

    gosuWs.onerror = () => {
      logger.error(consolePrefix + "Gosumemory WebSocket connection error.");
    };

    function updateAspect(gosuData) {
      const osuPath = gosuData.settings.folders.game;
      fs.readFile(path.join(osuPath, "tournament.cfg"), (err, data) => {
        if (err) {
          // If failing to read the tournament.cfg file, fall back to the default value of 1
          // It can be because the file disappeared somehow,
          // or gosumemory(tosu) and tournament client is running remotely.
          session.lobby.aspect = 1;
          return;
        }
        data
          .toString()
          .split(/\r?\n/)
          .forEach((x) => {
            if (x.startsWith("Aspect")) {
              session.lobby.aspect = parseFloat(x.replace("Aspect", "").replace(/[^\d.-]/g, ""));
            }
          });
      });
    }

    let chatCount = 0;
    let mapIdTemp = 0;
    // eslint-disable-next-line no-unused-vars
    let modsTemp = -1;
    // Set timeout of the connection, as tosu just stops sending data when osu gets closed and
    // silently resumes when opened. With this we can detect situations where osu is restarted.
    let timeout = setTimeout(() => (connected = false), 1000);
    // Update osu! data when receiving websocket message
    gosuWs.onmessage = (event) => {
      let data;

      try {
        data = JSON.parse(event.data);
        // Reset the connection timeout
        clearTimeout(timeout);
        timeout = setTimeout(() => (connected = false), 1000);
      } catch (exception) {
        connected = false; // osu! is closed or something
        return;
      }

      let code = "";
      for (let i = 0; i < session.mappool.length; i++) {
        // Check if current map is mappool
        if (session.mappool[i].map_id === data.menu.bm.id) {
          code = session.mappool[i].code;
          break;
        }
      }

      let mods;
      if (code.startsWith("HD")) {
        mods = 8;
      } else if (code.startsWith("HR")) {
        mods = 16;
      } else if (code.startsWith("EZ")) {
        mods = 2;
      } else if (code.startsWith("DT")) {
        mods = 64;
      } else if (code.startsWith("HT")) {
        mods = 256;
      } else {
        mods = data.menu.mods.num;
      }

      const dt = (mods >> 6) % 2 === 1;

      // Update now playing data in session
      session.now_playing.osu.map_id = data.menu.bm.id;
      session.now_playing.osu.mapset_id = data.menu.bm.set;
      session.now_playing.osu.mods = mods;
      session.now_playing.osu.code = code;
      session.now_playing.osu.background = `https://assets.ppy.sh/beatmaps/${data.menu.bm.set}/covers/raw.jpg`;
      session.now_playing.osu.cover = `https://assets.ppy.sh/beatmaps/${data.menu.bm.set}/covers/cover.jpg`;
      session.now_playing.osu.title = data.menu.bm.metadata.title;
      session.now_playing.osu.artist = data.menu.bm.metadata.artist;
      session.now_playing.osu.mapper = data.menu.bm.metadata.mapper;
      session.now_playing.osu.difficulty = data.menu.bm.metadata.difficulty;
      session.now_playing.osu.length = data.menu.bm.time.mp3;
      session.now_playing.osu.time = data.menu.bm.time.current;
      session.now_playing.osu.count_circles = data.menu.bm.stats.circles;
      session.now_playing.osu.count_sliders = data.menu.bm.stats.sliders;
      session.now_playing.osu.count_spinners = data.menu.bm.stats.spinners;
      Object.assign(session.now_playing.osu.stats, {
        cs: data.menu.bm.stats.memoryCS,
        ar: data.menu.bm.stats.memoryAR,
        od: data.menu.bm.stats.memoryOD,
        hp: data.menu.bm.stats.memoryHP,
        //sr: data.menu.bm.stats.SR,  // Broken on tosu
        bpm: data.menu.bm.stats.BPM.common * (dt ? 2 / 3 : 1),
        length: data.menu.bm.time.full,
        modified: {
          cs: data.menu.bm.stats.CS,
          ar: data.menu.bm.stats.AR,
          od: data.menu.bm.stats.OD,
          hp: data.menu.bm.stats.HP,
          sr: data.menu.bm.stats.fullSR,
          bpm: data.menu.bm.stats.BPM.common,
          length: data.menu.bm.time.full * (dt ? 2 / 3 : 1),
        },
      });

      // Get original sr from the api
      if (mapIdTemp !== data.menu.bm.id) {
        // Beatmap changed
        let taskDone = true;

        v2.beatmaps.details({ type: "difficulty", id: data.menu.bm.id }).then((res) => {
          session.now_playing.osu.stats.sr = res?.attributes?.star_rating;
          if (!session.now_playing.osu.stats.sr) {
            taskDone = false;
          }
        });

        if (taskDone) mapIdTemp = data.menu.bm.id;
      }

      // If Tourney Mode
      let tourney = data.menu.state === 22;
      if (tourney) {
        // Match gosumemory and overlay's slot count
        if (session.lobby.players.length !== data.tourney.ipcClients.length) {
          logger.warn(
            consolePrefix +
              `Client slots count mismatch between local(${session.lobby.players.length}) and gosumemory(${data.tourney.ipcClients.length}).`
          );
          session.lobby.players = [];
          for (let i = 0; i < data.tourney.ipcClients.length; i++) {
            session.lobby.players.push({});
          }
          updateAspect(data); // Slot mismatch usually occurs when the client is restarted, when aspect can be changed
        }

        // Get aspect value in tournament.cfg: needed for determining 1vs1 or 2vs2 in KDC24
        if (!connected) {
          // Run only once when connected
          updateAspect(data);
        }

        // If not null, receive new chat messages
        if (data.tourney.manager.chat != null) {
          if (data.tourney.manager.chat.length > chatCount) {
            let chats2addCount = data.tourney.manager.chat.length - chatCount;
            chatCount = data.tourney.manager.chat.length;

            for (let i = 0; i < chats2addCount; i++) {
              session.chat.push([
                new Date(),
                data.tourney.manager.chat[chatCount - 1 - i].name,
                data.tourney.manager.chat[chatCount - 1 - i].messageBody,
              ]);
            }
          } else if (data.tourney.manager.chat.length < chatCount) {
            // If chat count has decreased, reset the chat
            session.chat = [];
            chatCount = 0;
          }
        }

        // Get players' live playdata
        for (let i = 0; i < data.tourney.ipcClients.length; i++) {
          session.lobby.players[i] = {
            id: data.tourney.ipcClients[i].spectating.userID,
            nick: data.tourney.ipcClients[i].spectating.name,
            score: data.tourney.ipcClients[i].gameplay.score,
            combo: data.tourney.ipcClients[i].gameplay.combo.current,
            acc: data.tourney.ipcClients[i].gameplay.accuracy,
          };
        }

        // Get manager data
        session.lobby.bo = data.tourney.manager.bestOF;
        session.lobby.set_scores = [
          data.tourney.manager.stars.left,
          data.tourney.manager.stars.right,
        ];
        session.lobby.scores = [
          data.tourney.manager.gameplay.score.left,
          data.tourney.manager.gameplay.score.right,
        ];

        // Get IPCstate
        session.progress.state = data.tourney.manager.ipcState;
      }

      // We are now connected as we received data just now
      connected = true;
    };
  }

  setupGosuWs();
};
