const { v2 } = require("osu-api-extended");

const ms = {
  od0: 79.5,
  od10: 19.5,
  ar0: 1800,
  ar5: 1200,
  ar10: 450,
};

const ms_step = {
  od: 6,
  ar_1: 120,
  ar_2: 150,
};

exports = module.exports = async function (mapId, stats, modsNum) {
  const dt = (modsNum >> 6) % 2 === 1;
  const ht = (modsNum >> 8) % 2 === 1;
  const hr = (modsNum >> 4) % 2 === 1;
  const ez = (modsNum >> 1) % 2 === 1;

  let cs = stats.cs;
  let ar = stats.ar;
  let od = stats.od;
  let hp = stats.hp;
  let sr = stats.sr;
  let bpm = stats.bpm;
  let length = stats.length;

  let speed = 1;
  if (dt) speed *= 1.5;
  if (ht) speed *= 0.75;

  let od_multiplier = 1;
  if (hr) od_multiplier *= 1.4;
  if (ez) od_multiplier *= 0.5;

  od *= od_multiplier;
  let odms = hr && !dt && !ht ? ms.od0 - ms_step.od * od : ms.od0 - Math.ceil(ms_step.od * od);

  //hp
  if (ez) hp *= 0.5;
  else if (hr) hp *= 1.4;

  //bpm
  let modifier = 1;
  if (dt) modifier *= 1.5;
  else if (ht) modifier *= 0.75;

  bpm *= modifier;
  length /= modifier;

  //ar
  let ar_multiplier = 1;

  if (hr) ar_multiplier *= 1.4;
  if (ez) ar_multiplier *= 0.5;

  ar *= ar_multiplier;
  let arms = ar <= 5 ? ms.ar0 - ms_step.ar_1 * ar : ms.ar5 - ms_step.ar_2 * (ar - 5);

  //cs
  let cs_multiplier = 1;
  if (hr) cs_multiplier *= 1.3;
  if (ez) cs_multiplier *= 0.5;

  // stats must be capped to 0-10 before HT/DT which bring them to a range
  // of -4.42 to 11.08 for OD and -5 to 11 for AR
  odms = Math.min(ms.od0, Math.max(ms.od10, odms));
  arms = Math.min(ms.ar0, Math.max(ms.ar10, arms));

  // apply speed-changing mods
  odms /= speed;
  arms /= speed;

  // convert OD and AR back into their stat form
  od = (ms.od0 - odms) / ms_step.od;
  ar = ar <= 5 ? (ms.ar0 - arms) / ms_step.ar_1 : 5.0 + (ms.ar5 - arms) / ms_step.ar_2;

  cs *= cs_multiplier;
  cs = Math.max(0, Math.min(10, cs));

  // get star rating from the osu api
  if (ez || hr || dt || ht) {
    const attributes = await v2.beatmaps.lookup({ type: "attributes", id: mapId, mods: modsNum });
    if (!attributes.hasOwn("authentication") && attributes.hasOwn("difficulty_rating")) {
      sr = attributes.difficulty_rating;
    }
  }

  return { cs, ar, od, hp, sr, bpm, length };
};
