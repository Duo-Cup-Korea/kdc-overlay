class beefwebInterface {
  constructor(beefwebConfig) {
    this.host = beefwebConfig.host;
    this.port = beefwebConfig.port;
  }

  async getNowPlaying() {
    const res = await fetch(
      `http://${this.host}:${this.port}/api/query?player=true&trcolumns=%25artist%25,%25title%25`
    );

    return res.json();
  }
}

exports = module.exports = { beefwebInterface };
