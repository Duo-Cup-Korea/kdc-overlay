/**
 * Returns 2d array sliced from the original 2d array by starting and ending cell.
 *
 * @param {Array} data
 * @param {Array} index
 * @returns
 */
function byIndex(data, index) {
  let startPoint = [0, 0];
  let endPoint = [0, 0];
  const size = [data.length, data[0].length];

  if (!index.length) {
    return data;
  } else if (index.length === 1) {
    if (index[0][0] !== -1 && index[0][1] !== -1) {
      // Single cell range specified
      return data[index[0][0]][index[0][1]];
    } else if (index[0][0] === -1) {
      // Row not selected; single column range specified
      startPoint = [0, index[0][1]];
      endPoint = [size[0], index[0][1]];
    } else if (index[0][1] === -1) {
      // Column not selected: single row range specified
      startPoint = [index[0][0], 0];
      endPoint = [index[0][0], size[1]];
    }
  } else if (index.length === 2) {
    startPoint = index[0].map((x) => (x !== -1 ? x : 0));
    endPoint = index[1].map((x, i) => (x !== -1 ? x : size[i]));
  }

  return data
    .slice(startPoint[0], endPoint[0] + 1)
    .map((x) => x.slice(startPoint[1], endPoint[1] + 1));
}

/**
 * Returns 2d array sliced from the original 2d array by an excel-like range string.
 *
 * @param {Array} data
 * @param {String} range
 * @returns
 */
function byRange(data, range) {
  if (!range) {
    return byIndex(data, []);
  }

  const parsedRange = range.split(":").map((x) => {
    const alphabetPart = x.replace(/\d/g, "").toUpperCase();
    const numberPart = x.replace(/\D/g, "");

    let row = -1; // Array index starts from 0
    let col = -1;

    if (numberPart) row = parseInt(numberPart) - 1;

    for (let i = 0; i < alphabetPart.length; i++) {
      // Convert each char of column letter to index (A=1, AA=27, etc.)
      col += (alphabetPart.charCodeAt(i) - 64) * 26 ** (alphabetPart.length - i - 1);
    }

    return [row, col]; //
  });

  return byIndex(data, parsedRange);
}

exports = module.exports = { byIndex, byRange };
