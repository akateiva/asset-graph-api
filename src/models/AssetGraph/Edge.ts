import {Exchange, IMarketTicker, ITransition, IMarketPair, Vertex, Transition} from "./index";

export default class Edge {
  public start: Vertex;
  public end: Vertex;
  public pairs: Map < Exchange, IMarketPair >;

  constructor(start: Vertex, end: Vertex, pairs?: Map <Exchange, IMarketPair>) {
    if (pairs) {
      this.pairs = pairs;
    } else {
      this.pairs = new Map < Exchange, IMarketPair >();
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

  public upsertMarketPair(newPair: IMarketPair) {
    let pair = this.pairs.get(newPair.exchange);
    if (!pair) {
      pair = newPair;
      this.pairs.set(pair.exchange, pair);
    } else {
      pair.askPrice = newPair.askPrice;
      pair.bidPrice = newPair.bidPrice;
      pair.basePrice = newPair.basePrice;
      pair.baseVolume = newPair.baseVolume;
      pair.date = newPair.date;
    }
  }

  public getTransitions(filter: (e: Edge, m: IMarketPair) => boolean): ITransition[] {
    return Array.from(this.pairs.values()).filter(filter.bind(null, this))
      .map((t) => this.makeTransition(t));
  }

  public getTransitionByExchange(exchange: string): ITransition | undefined {
    const marketPair = this.pairs.get(exchange);
    if (!marketPair) { return undefined; }
    return this.makeTransition(marketPair);
  }

  private makeTransition(marketPair: IMarketPair): ITransition {
    return new Transition(this.start, this.end, this, marketPair);
  }
}
