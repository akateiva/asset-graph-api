import {
  Request,
  Response,
} from "express";
import * as AssetGraph from "../models/AssetGraph";
import * as Orderbook from "../models/Orderbook";
import Logger from "../util/logger";

const logger = Logger.child({
  name: "AssetGraphController",
});

declare namespace CycleSearchResult {
  export interface ITrade {
    buy: string;
    sell: string;
    exchange: string;
    unitLastPrice: number;
    unitLastPriceDate: string;
    relativeVolume: number;
  }

  export interface ICycle {
    maxRate: number;
    id: string; // a unique identifier contains sell[n],exchange[n]
    trades: ITrade[];
  }

  export interface IRootObject {
    took: number;
    timeExhausted: boolean;
    cycles: ICycle[];
  }
}

// returns the cost of a transition based on last/ask/bid ticker price
// 1 BUY_CURRENCY costs X SELL_CURRENCY
function getTransitionUnitCost(...transitions: AssetGraph.ITransition[]): number {
  let rate = 1;
  for (const transition of transitions) {
    let transitionRate: number;
    // selling base / buying market = asks
    if (transition.sell.asset === transition.marketPair.market) {
      transitionRate = transition.marketPair.askPrice || transition.marketPair.basePrice;
    } else {
      // selling market / buying base = bids
      // invert, because the cost has to be in sell currency
      transitionRate = 1 / (transition.marketPair.bidPrice || transition.marketPair.basePrice);
    }
    rate *= transitionRate; // * (1 - 0.0025);
  }
  return rate;
}

function serializeCycle(transitions: AssetGraph.ITransition[]): string {
  return transitions.reduce((identifierString, transition) => {
    identifierString += `${transition.sell.asset.symbol},${transition.marketPair.exchange},`;
    return identifierString;
  }, "");
}

function deserializeCycle(id: string): AssetGraph.ITransition[] {
  const idComponents = id.split(",");
  if (idComponents.length % 2 !== 0) {
    throw new Error("there must be an even number of id components");
  }
  const transitions: AssetGraph.ITransition[] = [];
  for (let i = 0; i < idComponents.length; i += 2) {
    const sellAssetSymbol = idComponents[i];
    const buyAssetSymbol = idComponents[i + 2] || idComponents[0];
    const exchange = idComponents[i + 1];
    const edge = AssetGraph.Graph.getEdgeBySymbols(sellAssetSymbol, buyAssetSymbol);
    if (!edge) {
      logger.error({
        sellAssetSymbol,
        buyAssetSymbol,
        exchange,
      }, "could not find edge");
      throw new Error("could not find edge");
    }
    const transition = edge.getTransitionByExchange(exchange);
    if (!transition) {
      throw new Error("could not find transition");
    }
    transitions.push(transition);
  }
  return transitions;
}

function makeCycle(...transitions: AssetGraph.ITransition[]): CycleSearchResult.ICycle {
  const cycle: CycleSearchResult.ICycle = transitions.reduceRight((signal, transition) => {
    const transitionExchangeRate = getTransitionUnitCost(transition);
    const trade = {
      buy: transition.buy.asset.symbol,
      sell: transition.sell.asset.symbol,
      exchange: transition.marketPair.exchange,
      unitLastPrice: transitionExchangeRate,
      unitLastPriceDate: transition.marketPair.date.toISOString(),
      relativeVolume: transition.marketPair.baseVolume,
    };
    signal.trades.unshift(trade);
    signal.maxRate *= transitionExchangeRate;
    return signal;
  }, {
    trades: [] as CycleSearchResult.ITrade[],
    id: serializeCycle(transitions),
    maxRate: 1,
  });

  return cycle;
}

// todo: write a test
export function findCycles(req: Request, res: Response) {
  const started = new Date(); // record when the request started
  const baseAsset = req.params.baseAsset; // asset from which the cycle search will be performed
  const timeoutMs = 200; // maximum time the search can run for
  const signalRateThreshold = 1.01; // minimum rate for a signal to be generated; +1% in this case
  const result: CycleSearchResult.IRootObject = {
    cycles: [],
    took: NaN,
    timeExhausted: false,
  };
  if (!baseAsset) {
    throw new Error("no base asset provided");
  }
  const baseVertex = AssetGraph.Graph.getVertexByAsset({
    symbol: baseAsset,
  });
  if (!baseVertex) {
    throw new Error("no such asset in the graph");
  }

  let combinationsExplored = 0;
  let timeExhausted = false;
  const timeout = setTimeout(() => {
    timeExhausted = true;
  }, timeoutMs);

  firstOrderLoop:
    for (const firstOrderTransition of baseVertex.getTransitions()) {
      for (const secondOrderTransition of firstOrderTransition.buy.getTransitions()) {
        if (firstOrderTransition.sell === secondOrderTransition.buy) {
          continue;
        }
        for (const thirdOrderTransition of secondOrderTransition.buy.getTransitions()) {
          combinationsExplored++;
          if (firstOrderTransition.sell !== thirdOrderTransition.buy) {
            continue;
          }
          if (timeExhausted) {
            break firstOrderLoop;
          }
          const rate = getTransitionUnitCost(firstOrderTransition, secondOrderTransition, thirdOrderTransition);
          if (rate > signalRateThreshold) {
            result.cycles.push(makeCycle(firstOrderTransition, secondOrderTransition, thirdOrderTransition));
          }
        }
      }
    }

  result.took = new Date().getTime() - started.getTime();
  result.timeExhausted = timeExhausted;
  res.json(result);
}

function getOrdersInTransitionSellCurrency(transition: AssetGraph.ITransition, orderbook: IOrderBook, askOrBid: "ask"|"bid"): Array<[number, number]> {
  let orders: Array<[number, number]>;
  // order prices should be in transition.sell currency
  if (askOrBid === "ask") {
    // we are buying the market/selling base currency, and the orderbook contains prices in base currency
    orders = orderbook.asks;
  } else {
    // we are buying the base currency/ selling market, so we want the prices to be in market currency
    orders = orderbook.bids.map(([bidPrice, bidAmount]: [number, number]) => {
      return [1 / bidPrice, bidAmount * bidPrice] as[number, number];
    });
  }
  return orders;
}

function computeTransitionRevenue(endownment: number, orders: Array<[number, number]> ): number {
  let cost = 0;
  let bought = 0;
  for (const order of orders) {
    const amount = order[1];
    const price = order[0];
    const toBuy = endownment - bought;
    if (toBuy > amount) {
      cost += amount * price;
      bought += amount;
    } else {
      cost += toBuy * price;
      bought += toBuy;
    }
  }
  if (bought !== endownment) { throw new Error("not enough orders to support this buy"); }
  return cost;
}

export async function getCycle(req: Request, res: Response) {
  const cycleId = req.params.cycleId;
  if (!cycleId) {
    throw new Error("no cycle id provided");
  }

  try {
    const transitions = deserializeCycle(cycleId);
    const orderbooks = await Promise.all(transitions.map(Orderbook.getOrderbookForTransition));
    logger.info(orderbooks, "got orderbooks my man");
  } catch (e) {
    logger.error(e);
  }

  // for every transition i should have a method to get the order book
  // then i can have a method calculateCycleRevenue(endownment: number)
  res.send("OK");
}
