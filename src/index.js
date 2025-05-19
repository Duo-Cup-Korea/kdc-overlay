const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const logger = require("winston");
const parseArgs = require("minimist");

const { initializeLogger } = require("./logger");
const { initializeOsuApi } = require("./osuApi");

const { start } = require("./entry");
const { mappoolgen } = require("./scripts/mappoolgen");

var argv = parseArgs(process.argv.slice(2));

const helpText = `
kdc-overlay
Duo Cup: KOREA 2025 Broadcasting Tool

Usage:
  kdc-overlay                   # Runs the program.
  kdc-overlay mappoolgen        # Generates mappool.json file from mappool.csv.
  kdc-overlay -h | --help
  kdc-overlay -v | --version

Options:
  -h --help     Show this screen.
  -v --version  Show version.`;

async function entry() {
  if (argv?.h) {
    console.log(helpText);
  } else {
    // Minimal Setup
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
    await initializeOsuApi(config);

    // End of initial setup

    if (argv._[0] === "mappoolgen") {
      mappoolgen();
    } else {
      // Main Entry
      start(config);
    }
  }
}

entry();
