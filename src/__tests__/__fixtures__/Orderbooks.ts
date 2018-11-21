let date = new Date();
date.toISOString();

const USDEUR = {
    asks: [
      [0.89, 10000]
    ],
    bids: [
      [0.87, 10000]
    ],
    timestamp: 1499280391811, // Unix Timestamp in milliseconds (seconds * 1000)
    datetime: date, // ISO8601 datetime string with milliseconds
};

const USDLTL = {
    asks: [
      [0.34, 10000]
    ],
    bids: [
      [0.32, 10000]
    ],
    timestamp: 1499280391812, // Unix Timestamp in milliseconds (seconds * 1000)
    datetime: date, // ISO8601 datetime string with milliseconds
};

const EURLTL = {
    asks: [
      [0.31, 10000]
    ],
    bids: [
      [0.29, 10000]
    ],
    timestamp: 1499280391813, // Unix Timestamp in milliseconds (seconds * 1000)
    datetime: date, // ISO8601 datetime string with milliseconds
};

export default {USDEUR, USDLTL, EURLTL};
