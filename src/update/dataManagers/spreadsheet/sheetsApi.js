// const logger = require("winston");
const { waitForCondition } = require("../../../utils");

class SlottedSheetsFetcher {
  constructor(sheets, sheetId, slotDuration = 1100) {
    this.sheets = sheets; // Google Sheets API instance
    this.sheetId = sheetId; // Spreadsheet ID
    this.slotDuration = slotDuration; // Time slot duration in milliseconds
    this.requestQueue = new Map(); // Queue to handle requests within the current slot
    this.timer = null; // Timer for batching
    this.fetching = false;
  }

  async fetchRange(range) {
    // Ensure ambiguous ranges are wrapped in quotes
    const formattedRange = range.includes("!") ? "range" : `'${range}'`;

    // logger.verbose("[sheetsAPI] Received range request: " + range);

    await waitForCondition(() => !this.fetching);

    return new Promise((resolve, reject) => {
      if (!this.requestQueue.has(formattedRange)) {
        // Initialize a new entry for the range
        this.requestQueue.set(formattedRange, { resolvers: [], rejecters: [] });
      }

      // Add the resolve and reject functions to the list for this range
      const requestEntry = this.requestQueue.get(formattedRange);
      requestEntry.resolvers.push(resolve);
      requestEntry.rejecters.push(reject);

      if (!this.timer) {
        this.timer = setTimeout(() => this.processBatch(), this.slotDuration);
      }
    });
  }

  async processBatch() {
    // Clear the timer
    this.timer = null;
    this.fetching = true;

    // Get the current batch of ranges
    const ranges = Array.from(this.requestQueue.keys());

    // logger.verbose("[sheetsAPI] Calling API for: " + ranges);

    try {
      // Make a batch request
      const response = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.sheetId,
        ranges,
      });

      const valueRanges = response.data.valueRanges;

      // Resolve each request with the corresponding data
      ranges.forEach((range, index) => {
        const requestEntry = this.requestQueue.get(range);
        const valueRange = valueRanges[index];

        if (valueRange) {
          requestEntry.resolvers.forEach((resolve) => resolve(valueRange));
        } else {
          const error = new Error(`No data found for range: ${range}`);
          requestEntry.rejecters.forEach((reject) => reject(error));
        }
      });
    } catch (error) {
      // Reject all requests if the batch request fails
      ranges.forEach((range) => {
        const requestEntry = this.requestQueue.get(range);
        requestEntry.rejecters.forEach((reject) => reject(error));
      });
    } finally {
      // Clear the request queue for the current slot
      this.requestQueue.clear();
      this.fetching = false;
    }
  }
}

module.exports = { SlottedSheetsFetcher };
