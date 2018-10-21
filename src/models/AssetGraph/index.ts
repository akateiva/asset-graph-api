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
  baseVolume: number
}

export interface IConversionResult {
  from: string;
  to: string;
  rate: number;
  via: {
    marketPair: MarketPair;
  }[]
}

export interface IAssetTransition {
  edge: Edge;
  pair: MarketPair;
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

export interface IArbitrageCycle {
  rate: number;
  transitions: IAssetTransition[];
}

export {Vertex, Edge, Graph}
