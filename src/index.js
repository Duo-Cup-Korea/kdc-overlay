const http = require("http");
const yaml = require("js-yaml");
const express = require("express");
const ip = require("ip");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const logger = require("winston");

const { initializeLogger } = require("./logger");
const { initializeOsuApi } = require("./osuApi");
const { Apis } = require("./api");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

async function Init() {
  const configFileExists = fs.existsSync(path.join(process.cwd(), "config.yaml"));
  const streamConfigFileExists = fs.existsSync(path.join(process.cwd(), "config_stream.yaml"));
  const firstRun = !(configFileExists && streamConfigFileExists);

  if (firstRun) {
    if (!configFileExists) {
      await fs.copyFileSync(
        path.join(__dirname, "templates/configs/config.default.yaml"),
        path.join(process.cwd(), "config.yaml")
      );
      logger.info("Default config file created! Please re-run the program after you complete!");
    }
    if (!streamConfigFileExists) {
      await fs.copyFileSync(
        path.join(__dirname, "templates/configs/config_stream.default.yaml"),
        path.join(process.cwd(), "config_stream.yaml")
      );
      logger.info(
        "Default streamConfig file created! Please re-run the program after you complete!"
      );
    }
    process.exit();
  }

  const config = yaml.load(
    fs.readFileSync(path.join(process.cwd(), "config.yaml"), { encoding: "utf8", flag: "r" })
  );

  // initialize logger
  initializeLogger(config.logLevel);

  // osu!api (v2) init
  initializeOsuApi(config);

  // Static Folder
  app.use("/", express.static(path.join(__dirname, "../public")));

  // API
  const api = new Apis(config);
  app.use("/api", api.router);

  // Info fetching and sending to browser
  require("./update")(config, io.of("/update"));

  // Run Server
  server.listen(config.port, () => {
    logger.info(
      `osu!mania Long Note Tournament 4 overlay backend server running at http://${ip.address()}:${config.port}/`
    );
  });
}

Init();
