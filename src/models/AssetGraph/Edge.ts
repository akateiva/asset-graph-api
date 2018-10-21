import {Vertex, Exchange, MarketPair} from './index';

export default class Edge {
  public start: Vertex;
  public end: Vertex;
  public pairs: Map < Exchange, MarketPair > = new Map < Exchange, MarketPair > ();

  constructor(start: Vertex, end: Vertex) {
    this.start = start;
    this.end = end;
    start.edges.push(this);
  }

  public averageExchangeRate(): number {
    var numerator = 0;
    var denominator = 0;
    for (let marketPair of this.pairs.values()) {
      if (marketPair.market === this.start.asset) {
        numerator += marketPair.baseVolume * marketPair.basePrice;
        denominator += marketPair.baseVolume;
      } else {
        numerator = 1 / (marketPair.basePrice * marketPair.baseVolume);;
        denominator += 1 / marketPair.baseVolume;
      }
    }
    return numerator / denominator;
  }
}
