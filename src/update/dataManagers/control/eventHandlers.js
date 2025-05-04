class ControlEventHandlers {
  constructor(config, session) {
    this.config = config;
    this.session = session;
  }

  updateSchedule(schedule) {
    this.session.schedule = schedule;
    /* logger.info(this.session.schedule);
    setTimeout(() => {
      logger.info(this.session.schedule);
    }, 2000); */
  }

  updateTitle(title) {
    this.session.stream_title = title;
  }

  showPersonCards(showObject, io) {
    io.emit("showPersonCards", showObject);
  }
}

exports = module.exports = { ControlEventHandlers };
