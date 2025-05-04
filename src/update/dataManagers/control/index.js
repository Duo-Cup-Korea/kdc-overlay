const path = require("path");
const chokidar = require("chokidar");
const csv = require("csvtojson");
const logger = require("winston");

const { ControlEventHandlers } = require("./eventHandlers");

const peopleCsvPath = path.join(process.cwd(), "people.csv");

class ControlManager {
  constructor(config, session, io) {
    this.config = config;
    this.session = session;
    this.io = io;
    this.handlers = new ControlEventHandlers(config, session);
  }

  init() {
    this.setup();
    this.CSL_watchPeopleList();
  }

  setup() {
    this.io.on("connection", (socket) => {
      socket.on("control", (res) => {
        this.handleControlEvent(res, this.io);
      });
    });
  }

  CSL_watchPeopleList() {
    chokidar.watch(peopleCsvPath).on("all", () => {
      csv()
        .fromFile(peopleCsvPath)
        .then((jsonObj) => {
          this.session.CSL.people = jsonObj;
        });
    });
  }

  handleControlEvent(data, io) {
    logger.verbose(data);
    switch (data.type) {
      case "titleUpdate":
        this.handlers.updateTitle(data.data); // data: <String> new Stream Title
        break;
      case "scheduleUpdate":
        this.handlers.updateSchedule(data.data); // data: <String> new schedule in ISO
        break;
      case "showPersonCards":
        this.handlers.showPersonCards(data.data, io); // "data":{"duration":5,"people":[{"nick":"Fuvell","pfp":"https://a.ppy.sh/10220343","uid":"10220343","desc":"Host"}]}
        break;
    }
  }
}

exports = module.exports = { ControlManager };
