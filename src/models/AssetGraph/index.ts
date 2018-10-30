import * as mongodb from "../../util/mongo";
import Vertex from "./Vertex";
import Edge from "./Edge";
import Graph from "./Graph";

export type AssetSymbol = string;

export type Exchange = string;

export type Path = Edge[];

export interface Asset {
  symbol: AssetSymbol
}

export interface MarketPair {
  exchange: Exchange
  base: Asset
  market: Asset
  basePrice: number
  bidPrice?: number
  askPrice?: number
  baseVolume: number
  date: Date
}


export interface IMarketTicker {
  Name: string
  BaseCurrency: string
  MarketCurrency: string
  ReceivedOn: Date
  BaseVolume: number
  Exchange: string
  Ask: number
  Bid: number
  Last: number
  WriteDate: Date
}

export interface ITransition {
  sell: Vertex;
  buy: Vertex;
  edge: Edge;
  marketPair: MarketPair;
}

const DEFAULT_GRAPH_INSTANCE = new Graph();
mongodb.client.on('open', (client) => {
  //TODO: parse tickers n shit
})

export {Vertex, Edge, DEFAULT_GRAPH_INSTANCE as Graph};
