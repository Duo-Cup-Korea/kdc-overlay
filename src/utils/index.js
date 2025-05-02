const applyMods = require("./difficultyCalculator");
const get2dValue = require("./get2dValue");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRandomInt = (max) => {
  return Math.floor(Math.random() * max);
};

const waitForCondition = (conditionFn, interval = 100) => {
  return new Promise((resolve) => {
    const checkCondition = setInterval(() => {
      if (conditionFn()) {
        clearInterval(checkCondition);
        resolve();
      }
    }, interval);
  });
};

module.exports = {
  applyMods,
  get2dValue,
  delay,
  getRandomInt,
  waitForCondition,
};
