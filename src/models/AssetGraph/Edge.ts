import {Exchange, IMarketTicker, MarketPair, Vertex} from "./index";

export default class Edge {
  public start: Vertex;
  public end: Vertex;
  public pairs: Map < Exchange, MarketPair >;

  constructor(start: Vertex, end: Vertex, pairs?: Map <Exchange, MarketPair>) {
    if (pairs) {
      this.pairs = pairs;
    } else {
      this.pairs = new Map < Exchange, MarketPair >();
    }
    this.start = start;
    this.end = end;
    start.edges.push(this);
  }

  public getHash(): string {
    return this.start.asset.symbol + "-" + this.end.asset.symbol;
  }

  public averageExchangeRate(): number {
    let numerator = 0;
    let denominator = 0;
    for (const marketPair of this.pairs.values()) {
      if (marketPair.market === this.start.asset) {
        numerator += marketPair.baseVolume * marketPair.basePrice;
        denominator += marketPair.baseVolume;
      } else {
        numerator += 1 / (marketPair.basePrice * marketPair.baseVolume);
        denominator += 1 / marketPair.baseVolume;
      }
    }
    return numerator / denominator;
  }

  public upsertMarketPair(newPair: MarketPair) {
    let pair = this.pairs.get(newPair.exchange);
    if (!pair) {
      pair = newPair;
      this.pairs.set(pair.exchange, pair);
    } else {
      pair.basePrice = newPair.basePrice;
      pair.baseVolume = newPair.baseVolume;
      pair.date = newPair.date;
    }
  }
}
