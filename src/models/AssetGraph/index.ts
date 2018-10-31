import Logger from "../../util/logger";
import Edge from "./Edge";
import Graph from "./Graph";
import Vertex from "./Vertex";
import {
  MongoClient
} from "mongodb";

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
  bidPrice ? : number;
  askPrice ? : number;
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
export async function attachToMongo(client: MongoClient) {
  // Load data on connect
  logger.info("querying tickers from database");
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
        Exchange: "$Exchange",
        Name: "$Name",
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
    // @ts-ignore
  }]).forEach((ticker: IMarketTicker) => {
    DEFAULT_GRAPH_INSTANCE.processMarketTicker(ticker);
  });

  // Subscribe to new tickers
  logger.info("subscribing to ticker changes");
  return client.db("xlab-prices").collection("prices").watch([{
      $match: {
        operationType: "insert",
      },
    }])
    .on("change", (change: any) => {
      DEFAULT_GRAPH_INSTANCE.processMarketTicker(change.fullDocument);
    })
    .on("close", () => {
      console.log("closed");
    })
    .on("error", (err) => {
      console.error(err)
    })
}

const logger = Logger.child({
  name: "AssetGraph",
});

export {
  Vertex,
  Edge,
  DEFAULT_GRAPH_INSTANCE as Graph,
  logger as Logger,
};
