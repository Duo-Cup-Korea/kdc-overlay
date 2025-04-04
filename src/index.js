const http = require("http");
const yaml = require("js-yaml");
const express = require("express");
const internalIp = require("internal-ip");
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const fs = require("fs");
const path = require("path");
const logger = require("winston");
require("./logger")();

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
  } else {
    const config = yaml.load(
      fs.readFileSync(path.join(process.cwd(), "config.yaml"), { encoding: "utf8", flag: "r" })
    );

    // osu!api (v2) init
    require("./osuAPI")(config);

    // Static Folder
    app.use("/", express.static(path.join(__dirname, "../public")));

    // API
    const api = require("./api")(config, logger);
    app.use("/api", api);

    // Info fetching and sending to browser
    require("./update")(config, io.of("/update"));

    // Run Server
    server.listen(config.port, () => {
      logger.info(
        `osu!mania Long Note Tournament 4 overlay backend server running at http://${internalIp.internalIpV4Sync()}:${config.port}/`
      );
    });
  }
}

Init();
