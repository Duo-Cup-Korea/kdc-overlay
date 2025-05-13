class Fb2kManager {
  constructor(config, session) {
    this.port = config.port;
    this.npData = session.now_playing;
  }

  init() {
    setInterval(() => this.updateData(), 200);
  }

  updateData() {
    // Use own api endpoint
    if (this.port) {
      fetch(`http://127.0.0.1:${this.port}/api/fb2k/nowplaying`)
        .then((response) => response.json())
        .then((data) => {
          if (
            data.fb2k_running &&
            data.player.activeItem.index !== -1 &&
            data.player.playbackState !== "stopped"
          ) {
            this.npData.mode = "fb2k";
            this.npData.fb2k.title = data.player.activeItem.columns[1];
            this.npData.fb2k.artist = data.player.activeItem.columns[0];
            this.npData.fb2k.time = data.player.activeItem.position * 1000;
            this.npData.fb2k.length = data.player.activeItem.duration * 1000;
          } else {
            this.npData.mode = "osu";
          }
        });
    }
  }
}

exports = module.exports = { Fb2kManager };
