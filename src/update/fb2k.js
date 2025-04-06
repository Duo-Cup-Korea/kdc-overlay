exports = module.exports = function (config, session) {
  function fb2k_updateNowplaying() {
    fetch(`http://127.0.0.1:${config.port}/api/fb2k/nowplaying`)
      .then((response) => response.json())
      .then((data) => {
        if (
          data.fb2k_running &&
          data.player.activeItem.index !== -1 &&
          data.player.playbackState !== "stopped"
        ) {
          session.now_playing.mode = "fb2k";
          session.now_playing.fb2k.title = data.player.activeItem.columns[1];
          session.now_playing.fb2k.artist = data.player.activeItem.columns[0];
          session.now_playing.fb2k.time = data.player.activeItem.position * 1000;
          session.now_playing.fb2k.length = data.player.activeItem.duration * 1000;
        } else {
          session.now_playing.mode = "osu";
        }
      });
  }

  setInterval(fb2k_updateNowplaying, 200);
};
