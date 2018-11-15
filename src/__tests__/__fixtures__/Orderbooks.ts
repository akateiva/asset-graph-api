var date = new Date();
date.toISOString();

// '2017-07-05T18:47:14.694Z'

const Revenue = 
{
    "0.1" : 0.125, // { "Endowment" : Return }
    "0.2" : 0.250,
    "1" : 1.25,
    "5" : 3.65,
    "100" : 55.33,
    "1000" : NaN,
}

const EurUsdOrderBook = {
    'bids': [
        [ (25/22), 1 ], // [ price, amount ]
        [ 1, 80 ],
        [ 0.8, 120],
    ],
    'asks': [
        [ 1.5, 1 ],
        [ 2, 80],
        [3, 120],
    ],
    'timestamp': 1499280391811, // Unix Timestamp in milliseconds (seconds * 1000)
    'datetime': date, // ISO8601 datetime string with milliseconds
}

const UsdLtlOrderBook = {
    'bids': [
        [ 0.33, (25/22) ], // [ price, amount ]
        [ 0.3, 80 ],
        [ 0.2, 120],
    ],
    'asks': [
        [ 0.5, (25/22) ],
        [ 0.8, 80 ],
        [1, 120]
    ],
    'timestamp': 1499280391812, // Unix Timestamp in milliseconds (seconds * 1000)
    'datetime': date, // ISO8601 datetime string with milliseconds
}

const LtlEurOrderBook = {
    'bids': [
        [ (10/3), 0.375 ], // [ price, amount ]
        [ 2, 80 ],
        [1, 120]
    ],
    'asks': [
        [ 5, 0.375 ],
        [ 10, 80 ],
        [ 20, 120 ],
    ],
    'timestamp': 1499280391813, // Unix Timestamp in milliseconds (seconds * 1000)
    'datetime': date, // ISO8601 datetime string with milliseconds
}