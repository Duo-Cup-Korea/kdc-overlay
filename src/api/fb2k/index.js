const express = require("express");

const { controlserverInterface } = require("./controlserver");
const { beefwebInterface } = require("./beefweb");

class Fb2kApi {
  constructor(fb2kConfig) {
    this.router = express.Router();
    this.controlserver = new controlserverInterface(fb2kConfig.controlserver);
    this.beefweb = new beefwebInterface(fb2kConfig.beefweb);

    this.setup();
  }

  setup() {
    this.router.get("/nowplaying", (req, res) => {
      this.beefweb
        .getNowPlaying()
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

    this.router.get("/albumart", (req, res) => {
      if (this.controlserver.albumart) {
        const img = Buffer.from(this.controlserver.albumart, "base64");
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": img.length,
        });
        res.end(img);
      }
    });
  }
}

exports = module.exports = { Fb2kApi };
