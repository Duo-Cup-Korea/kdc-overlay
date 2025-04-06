const express = require("express");
const router = express.Router();
const logger = require("winston");

const net = require("net");

const consolePrefix = "[fb2k] ";

exports = module.exports = function (config) {
  const client = new net.Socket();
  let intervalConnect = false;

  let albumart;

  // foo_controlserver socket connection
  function connect() {
    client.connect({
      port: config.fb2k.controlserver.port,
      host: config.fb2k.controlserver.host,
    });
  }

  function launchIntervalConnect() {
    if (intervalConnect) return;
    intervalConnect = setInterval(connect, 5000);
  }

  function clearIntervalConnect() {
    if (!intervalConnect) return;
    clearInterval(intervalConnect);
    intervalConnect = false;
  }

  client.on("connect", () => {
    clearIntervalConnect();
    logger.info("Successfully Connected to foobar2000 control server!");
    updateAlbumArt();
  });

  let receivingAlbumArt = false;
  /*const fs = require("fs");
    let count = 0;*/

  client.on("data", (data) => {
    //fs.writeFileSync(`./temp/asdf${count++}.txt`, data.toString());
    if (receivingAlbumArt) {
      let dataString = data.toString().replace(/^\s+|\s+$/g, "");
      albumart += dataString.split("|")[0];
      if (dataString.endsWith("|")) {
        receivingAlbumArt = false;
        logger.info(consolePrefix + "Done fetching album art!");
      }
    } else {
      let lines = data
        .toString()
        .replace(/^\s+|\s+$/g, "")
        .split(/\r?\n/);
      lines.forEach((line) => {
        if (line.startsWith("701")) {
          logger.info(consolePrefix + "Downloading new album art!");
          albumart = line.split("|")[2];
          if (!line.endsWith("|")) {
            receivingAlbumArt = true;
          } else {
            logger.info(consolePrefix + "Done fetching album art!");
          }
        } else if (line.startsWith("111")) {
          logger.info(consolePrefix + "Song Changed!");
          updateAlbumArt();
        }
        logger.verbose(
          consolePrefix +
            (line.length > 500 ? line.substring(0, 500) + "\n(...Excessive output omitted)" : line)
        );
      });
    }
  });

  client.on("close", () => {
    if (!intervalConnect) {
      logger.info("Disconnected from foobar2000 control server.");
    }
    launchIntervalConnect();
  });

  client.on("error", () => {
    if (!intervalConnect) {
      logger.info("foobar2000 control server connection error.");
    }
    launchIntervalConnect();
  });

  client.on("end", launchIntervalConnect);

  function updateAlbumArt() {
    client.write("albumart\n");
  }

  connect();

  /**
   * routes
   */
  router.get("/nowplaying", (req, res) => {
    fetch(
      `http://${config.fb2k.beefweb.host}:${config.fb2k.beefweb.port}/api/query?player=true&trcolumns=%25artist%25,%25title%25`
    )
      .then((response) => response.json())
      .then((data) =>
        res.json({
          fb2k_running: true,
          player: data.player,
        })
      )
      .catch(() => {
        res.json({
          fb2k_running: false,
        });
      });
  });

  router.get("/albumart", (req, res) => {
    if (albumart) {
      let img = Buffer.from(albumart, "base64");
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": img.length,
      });
      res.end(img);
    }
  });

  return router;
};
