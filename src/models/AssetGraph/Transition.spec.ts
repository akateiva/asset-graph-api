import {Graph, Vertex, Edge} from "./index";
import Transition from "./Transition";

const fixture = {
  Name : "USD-EUR",
  Last : 0.88, // USD for 1 EUR
  BaseVolume : 50, // USD
  ReceivedOn : new Date(),
  MarketCurrency : "EUR",
  BaseCurrency : "USD",
  Exchange : "Exchange 3",
  Ask : 0.99, // USD for 1 EUR
  Bid : 0.8, // USD for 1 EUR
  WriteDate : new Date(),
};

Graph.processMarketTicker(fixture);

describe("computes the correct transition cost, volume in sell currency and position type", () => {
  it("sell base currency ", () => {
    // edge for selling USD, buying EUR
    const edge = Graph.getEdgeBySymbols(fixture.BaseCurrency, fixture.MarketCurrency);
    const transition = edge!.getTransitionByExchange(fixture.Exchange);
    // since we selling the base currency, we are expecting a long position
    // with a long position, we are taking from the ask orderbook
    expect(transition!.positionType).toBe("long");
    expect(transition!.unitCost).toEqual(1 / fixture.Ask);
    expect(transition!.volumeInSellCurrency).toEqual(fixture.BaseVolume);
  });

  it("sell market currency", () => {
    const edge = Graph.getEdgeBySymbols(fixture.MarketCurrency, fixture.BaseCurrency);
    const transition = edge!.getTransitionByExchange(fixture.Exchange);
    expect(transition!.positionType).toBe("short");
    expect(transition!.unitCost).toBe(fixture.Bid);
    expect(transition!.volumeInSellCurrency).toBe(fixture.BaseVolume / fixture.Bid);
  });

});
