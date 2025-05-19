const { w3cwebsocket: WebSocket } = require("websocket");
const { v2 } = require("osu-api-extended");
const path = require("path");
const fs = require("fs");
const logger = require("winston");

// eslint-disable-next-line no-unused-vars
const difficultyCalculator = require("../../utils/difficultyCalculator");

const consolePrefix = "[Gosumemory] ";

class GosumemoryManager {
  constructor(config, session) {
    this.config = config;
    this.session = session;

    this.gosuWs = null;
    this.connected = false;
    this.chatCount = 0;
    this.mapIdTemp = 0;
    this.modsTemp = -1;
    this.timeout = null;
  }

  init() {
    this.gosuWs = new WebSocket(
      `ws://${this.config.gosumemoryHost}:${this.config.gosumemoryPort}/ws`
    );
    this.setup();
  }

  setup() {
    this.gosuWs.onopen = () => {
      logger.info(consolePrefix + "Successfully connected to Gosumemory!");
      // this.connected will be updated on message
    };

    this.gosuWs.onclose = () => {
      logger.info(consolePrefix + "Gosumemory WebSocket connection closed.");
      this.connected = false;
      setTimeout(() => this.init(), 1000);
    };

    this.gosuWs.onerror = () => {
      logger.error(consolePrefix + "Gosumemory WebSocket connection error.");
    };

    // Update osu! data when receiving websocket message
    this.gosuWs.onmessage = (event) => this.onMessage(event);

    // (Re)set timeout of the connection, as tosu just stops sending data when osu gets closed and
    // silently resumes when opened. With this we can detect situations where osu is restarted.
    this.resetGosuTimeout();
  }

  onMessage(event) {
    let data;

    try {
      data = JSON.parse(event.data);
      // If succeeded, the connection alive. So we reset the timeout
      this.resetGosuTimeout();
    } catch (exception) {
      // osu! is closed or something
      this.connected = false;
      return;
    }

    let code = "";
    for (let i = 0; i < this.session.mappool.length; i++) {
      // Check if current map is mappool
      if (this.session.mappool[i].map_id === data.menu.bm.id) {
        code = this.session.mappool[i].code;
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
    Object.assign(this.session.now_playing.osu, {
      map_id: data.menu.bm.id,
      md5: data.menu.bm.md5,
      mapset_id: data.menu.bm.set,
      mods: mods,
      code: code,
      background: `https://assets.ppy.sh/beatmaps/${data.menu.bm.set}/covers/raw.jpg`,
      cover: `https://assets.ppy.sh/beatmaps/${data.menu.bm.set}/covers/cover.jpg`,
      title: data.menu.bm.metadata.title,
      artist: data.menu.bm.metadata.artist,
      mapper: data.menu.bm.metadata.mapper,
      difficulty: data.menu.bm.metadata.difficulty,
      length: data.menu.bm.time.mp3,
      time: data.menu.bm.time.current,
      count_circles: data.menu.bm.stats.circles,
      count_sliders: data.menu.bm.stats.sliders,
      count_spinners: data.menu.bm.stats.spinners,
    });
    Object.assign(this.session.now_playing.osu.stats, {
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
    if (this.mapIdTemp !== data.menu.bm.id) {
      // Beatmap changed
      let taskDone = true;

      if (data.menu.bm.id) {
        logger.verbose(`[osu!api] Going to query beatmap id ${data.menu.bm.id}!`);
        v2.beatmaps
          .details({ type: "difficulty", id: data.menu.bm.id })
          .then((res) => {
            this.session.now_playing.osu.stats.sr = res?.attributes?.star_rating;
            if (!this.session.now_playing.osu.stats.sr) {
              taskDone = false;
            }
          })
          .catch((err) => {
            logger.error(
              `[osu!api] API query failed for the beatmap ${data.menu.bm.id}: ${err.message}`
            );
          });
      }

      if (taskDone) this.mapIdTemp = data.menu.bm.id;
    }

    // If Tourney Mode
    let tourney = data.menu.state === 22;
    if (tourney) {
      // Match gosumemory and overlay's slot count
      if (this.session.lobby.players.length !== data.tourney.ipcClients.length) {
        logger.warn(
          consolePrefix +
            `Client slots count mismatch between local(${this.session.lobby.players.length}) and gosumemory(${data.tourney.ipcClients.length}).`
        );
        this.session.lobby.players = [];
        for (let i = 0; i < data.tourney.ipcClients.length; i++) {
          this.session.lobby.players.push({});
        }
        this.updateAspect(data); // Slot mismatch usually occurs when the client is restarted, when aspect can be changed
      }

      // Get aspect value in tournament.cfg: needed for determining 1vs1 or 2vs2 in KDC24
      if (!this.connected) {
        // Run only once when connected
        this.updateAspect(data);
      }

      // If not null, receive new chat messages
      if (data.tourney.manager.chat != null) {
        if (data.tourney.manager.chat.length > this.chatCount) {
          let chats2addCount = data.tourney.manager.chat.length - this.chatCount;
          this.chatCount = data.tourney.manager.chat.length;

          for (let i = 0; i < chats2addCount; i++) {
            this.session.chat.push([
              new Date(),
              data.tourney.manager.chat[this.chatCount - 1 - i].name,
              data.tourney.manager.chat[this.chatCount - 1 - i].messageBody,
            ]);
          }
        } else if (data.tourney.manager.chat.length < this.chatCount) {
          // If chat count has decreased, reset the chat
          this.session.chat = [];
          this.chatCount = 0;
        }
      }

      // Get players' live playdata
      for (let i = 0; i < data.tourney.ipcClients.length; i++) {
        this.session.lobby.players[i] = {
          id: data.tourney.ipcClients[i].spectating.userID,
          nick: data.tourney.ipcClients[i].spectating.name,
          score: data.tourney.ipcClients[i].gameplay.score,
          combo: data.tourney.ipcClients[i].gameplay.combo.current,
          acc: data.tourney.ipcClients[i].gameplay.accuracy,
        };
      }

      // Get manager data
      this.session.lobby.bo = data.tourney.manager.bestOF;
      this.session.lobby.set_scores = [
        data.tourney.manager.stars.left,
        data.tourney.manager.stars.right,
      ];
      this.session.lobby.scores = [
        data.tourney.manager.gameplay.score.left,
        data.tourney.manager.gameplay.score.right,
      ];

      // Get IPCstate
      this.session.progress.state = data.tourney.manager.ipcState;
    }

    // We are now connected as we received data just now
    this.connected = true;
  }

  resetGosuTimeout() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      logger.warn(consolePrefix + "Connection timed out.");
      this.connected = false;
    }, 1000);
  }

  updateAspect(gosuData) {
    const osuPath = gosuData.settings.folders.game;
    fs.readFile(path.join(osuPath, "tournament.cfg"), (err, data) => {
      if (err) {
        // If failing to read the tournament.cfg file, fall back to the default value of 1
        // It can be because the file disappeared somehow,
        // or gosumemory(tosu) and tournament client is running remotely.
        logger.error(
          consolePrefix +
            "Cannot read tournament.cfg to get the aspect value. Defaulting to 1. Is Gosumemory running remotely?"
        );
        this.session.lobby.aspect = 1;
        return;
      }
      data
        .toString()
        .split(/\r?\n/)
        .forEach((x) => {
          if (x.startsWith("Aspect")) {
            this.session.lobby.aspect = parseFloat(x.replace("Aspect", "").replace(/[^\d.-]/g, ""));
          }
        });
    });
  }
}

exports = module.exports = { GosumemoryManager };
