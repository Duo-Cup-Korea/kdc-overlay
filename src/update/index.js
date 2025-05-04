const express = require("express");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const yaml = require("js-yaml");
const logger = require("winston");

const dataManagers = require("./dataManagers");
const sessionTemplate = require("../templates/session");

class DataUpdater {
  constructor(config, io) {
    this.config = config;
    this.session = sessionTemplate;
    this.io = io;

    this.router = express.Router();

    this.managers = {
      control: new dataManagers.ControlManager(this.config, this.session, this.io),
      spreadsheet: new dataManagers.SpreadsheetManager(this.config, this.session),
      fb2k: new dataManagers.Fb2kManager(this.config, this.session),
      gosumemory: new dataManagers.GosumemoryManager(this.config, this.session),
    };

    setInterval(() => this.broadcastUpdate(), 100);
  }

  init() {
    this.setup();

    Object.values(this.managers).forEach((manager) => {
      manager.init();
    });

    this.router.get("/", (req, res) => {
      res.json(this.session);
    });
  }

  setup() {
    // Load streamConfig values and try to get mappool data from mappool.json
    // Update data whenever the files are changed
    chokidar
      .watch(path.join(process.cwd(), "config_stream.yaml"))
      .on("all", () => this.loadStreamConfig());
    chokidar
      .watch(path.join(process.cwd(), "mappool.json"))
      .on("all", () => this.loadManualMappool());
  }

  /**
   * Broadcast session data
   */
  broadcastUpdate() {
    this.io.emit("update", this.session);
  }

  loadStreamConfig() {
    logger.info("streamConfig file updated!");
    const streamConfig = yaml.load(
      fs.readFileSync(path.join(process.cwd(), "config_stream.yaml"), {
        encoding: "utf8",
        flag: "r",
      })
    );
    Object.assign(this.session, {
      type: streamConfig.type,
      match_code: streamConfig.match_code,
      mappool_name: streamConfig.mappool_name,
      bracket: streamConfig.mappool_name,
      schedule: streamConfig.schedule,
      stream_title: streamConfig.title,
    });
  }

  loadManualMappool() {
    // Get mappool data from mappool.json if exists
    if (fs.existsSync(path.join(process.cwd(), "mappool.json"))) {
      logger.warn("Manual mappool: got mappool data from the mappool.json");
      this.session.mappool_manual = true;
      this.session.mappool = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "mappool.json"), "utf-8")
      ).mappool;
    } else {
      this.session.mappool_manual = false;
    }
  }
}

exports = module.exports = { DataUpdater };
