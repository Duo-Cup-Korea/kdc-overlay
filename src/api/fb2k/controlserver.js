const net = require("net");
const logger = require("winston");

const consolePrefix = "[fb2k] ";

/**
 * foo_controlserver connectivity
 */
class controlserverInterface {
  constructor(controlserverConfig) {
    this.client = new net.Socket();
    this.intervalConnect = false;
    this.port = controlserverConfig.port;
    this.host = controlserverConfig.host;
    this.receivingAlbumArt = false;
    this.albumart = null;

    this.setup();
    this.connect();
  }

  setup() {
    this.client.on("connect", () => {
      this.clearIntervalConnect();
      logger.info(consolePrefix + "Successfully Connected to foobar2000 control server!");
      this.requestNewAlbumart();
    });

    this.client.on("close", () => {
      if (!this.intervalConnect) {
        logger.warn(consolePrefix + "Disconnected from foobar2000 control server. (close)");
      }
      this.launchIntervalConnect();
    });

    this.client.on("error", () => {
      if (!this.intervalConnect) {
        logger.error(consolePrefix + "foobar2000 control server connection error.");
      }
      this.launchIntervalConnect();
    });

    this.client.on("end", () => {
      logger.warn(consolePrefix + "Disconnected from foobar2000 control server. (end)");
      this.launchIntervalConnect();
    });

    this.client.on("data", (data) => this.onData(data));
  }

  connect() {
    this.client.connect({
      host: this.host,
      port: this.port,
    });
  }

  launchIntervalConnect() {
    if (this.intervalConnect) return;
    this.intervalConnect = setInterval(() => this.connect(), 5000);
  }

  clearIntervalConnect() {
    if (!this.intervalConnect) return;
    clearInterval(this.intervalConnect);
    this.intervalConnect = false;
  }

  requestNewAlbumart() {
    this.client.write("albumart\n");
  }

  onData(data) {
    if (this.receivingAlbumArt) {
      // Continue receiving albumart
      let dataString = data.toString().replace(/^\s+|\s+$/g, "");
      this.albumart += dataString.split("|")[0];
      if (dataString.endsWith("|")) {
        this.receivingAlbumArt = false;
        logger.info(consolePrefix + "Done fetching album art!");
      }
    } else {
      let lines = data
        .toString()
        .replace(/^\s+|\s+$/g, "")
        .split(/\r?\n/);
      lines.forEach((line) => {
        if (line.startsWith("701")) {
          // Albumart
          logger.info(consolePrefix + "Downloading new album art!");
          this.albumart = line.split("|")[2]; // Start receiving albumart
          if (!line.endsWith("|")) {
            this.receivingAlbumArt = true;
          } else {
            logger.info(consolePrefix + "Done fetching album art!"); // Whole albumart received at once
          }
        } else if (line.startsWith("111")) {
          // New song
          logger.info(consolePrefix + "Song Changed!");
          this.requestNewAlbumart(); // ERROR!
        }
        logger.verbose(
          // Log socket message
          consolePrefix +
            (line.length > 500 ? line.substring(0, 500) + "\n(...Excessive output omitted)" : line)
        );
      });
    }
  }
}

exports = module.exports = { controlserverInterface };
