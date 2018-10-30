import Logger from "../../util/logger";
import mongodb from "../../util/mongo";
import Edge from "./Edge";
import Graph from "./Graph";
import Vertex from "./Vertex";

export type AssetSymbol = string;

export type Exchange = string;

export type Path = Edge[];

export interface Asset {
  symbol: AssetSymbol;
}

export interface MarketPair {
  exchange: Exchange;
  base: Asset;
  market: Asset;
  basePrice: number;
  bidPrice ?: number;
  askPrice ?: number;
  baseVolume: number;
  date: Date;
}

export interface IMarketTicker {
  Name: string;
  BaseCurrency: string;
  MarketCurrency: string;
  ReceivedOn: Date;
  BaseVolume: number;
  Exchange: string;
  Ask: number;
  Bid: number;
  Last: number;
  WriteDate: Date;
}

export interface ITransition {
  sell: Vertex;
  buy: Vertex;
  edge: Edge;
  marketPair: MarketPair;
}

const DEFAULT_GRAPH_INSTANCE = new Graph();
mongodb.on("open", async (client) => {
  // Load data on connect
  console.log("querying mongodb for latest market states");
  const collection = client.db("xlab-prices").collection("prices");
  const fiveMinutesAgo = new Date(new Date().getTime() - 5 * 60 * 1000 * 1000);
  const result = await collection.aggregate([{
    // Limit this query to prices from the last 5 minutes
    $match: {
      WriteDate: {
        $gt: fiveMinutesAgo,
      },
    },
  }, {
    $sort: {
      WriteDate: 1,
    },
  }, {
    // Group by name and exchange. Place latest ticker in field ticker
    $group: {
      _id: {
        Name: "$Name",
        Exchange: "$Exchange",
      },
      ticker: {
        $last: "$$ROOT",
      },
    },
  }, {
    // Replace each aggregate result with latest ticker
    $replaceRoot: {
      newRoot: "$ticker",
    },
  }, {
    $sort: {
      BaseVolume: -1,
    },
  }]).forEach((ticker: IMarketTicker) => {
    DEFAULT_GRAPH_INSTANCE.processMarketTicker(ticker);
  });

  // Subscribe to new tickers
  console.log("subscribing to ticker changes");
  client.db("xlab-prices").collection("prices").watch([{
      $match: {
        operationType: "insert",
      },
    }])
    .on("change", (change: any) => {
      DEFAULT_GRAPH_INSTANCE.processMarketTicker(change.fullDocument);
    });
});

const logger = Logger.child({
  name: "AssetGraph",
});

export {
  Vertex,
  Edge,
  DEFAULT_GRAPH_INSTANCE as Graph,
  logger as Logger,
};
