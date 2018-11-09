import {Vertex, Edge, IMarketPair, ITransition } from "./index";

export default class Transition implements ITransition {
  public positionType: "short"|"long";
  constructor(public sell: Vertex, public buy: Vertex, public edge: Edge, public marketPair: IMarketPair) {
    this.positionType = (this.sell.asset === marketPair.market) ? "short" : "long";
  }

  // returns the price of 1 buy currency in terms of sell currency
  get unitCost(): number {
    if ( this.positionType === "short" ) {
      // taking from the bid side of the order book
      return this.marketPair.bidPrice || this.marketPair.basePrice;
    } else if ( this.positionType === "long" ) {
      // taking from the ask side of the order book
      return 1 / ( this.marketPair.askPrice || this.marketPair.basePrice);
    } else {
      throw new Error("should never happen");
    }
  }

  get volumeInSellCurrency(): number {
    if ( this.positionType === "short" ) {
      return this.marketPair.baseVolume / this.unitCost;
    } else {
      return this.marketPair.baseVolume;
    }
  }
}
