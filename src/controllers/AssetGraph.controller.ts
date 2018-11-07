import {
  Request,
  Response,
  NextFunction,
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
  }, "").slice(0, -1);
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
      throw new Error(`could not find transition ${sellAssetSymbol} to ${buyAssetSymbol} via ${exchange} `);
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
export function findCycles(req: Request, res: Response, next: NextFunction) {
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

function getOrdersInTransitionSellCurrency(orderbook: Orderbook.IOrderBook, askOrBid: "ask" | "bid"): Array < [number, number] > {
  // orderbooks give price in base, amount in market by default
  if (askOrBid === "bid") {
    // price in market, order amount in base
    return orderbook.bids;
  } else {
    // price in base, order amount in market
    return orderbook.asks.map(([price, amount]) => {
      return [1 / price, amount * price] as [number, number];
    });
  }
}

export function computeTransitionRevenue(endownment: number, orders: Array < [number, number] > ): number {
  let cost = 0;
  let revenue = 0;
  logger.debug("starting integrations");
  for (const order of orders) {
    const orderAmount = order[1];
    const orderPrice = order[0];
    const toSell = endownment - cost;
    if (toSell > orderAmount) {
      revenue += orderAmount * orderPrice;
      cost += orderAmount;
    } else {
      revenue += toSell * orderPrice;
      cost += toSell;
      logger.debug({toSell, orderPrice}, "one order is enough");
      break;
    }
    logger.debug({orderAmount, orderPrice, revenue, cost, nextToSell: endownment - cost}, "integration step");
  }
  if (cost !== endownment) { revenue = NaN; }

  return revenue;
}

function computeTotalRevenue(endownment: number, transitionsOrders: Array < Array < [number, number] >> ): number {
  const totalRevenue = transitionsOrders.reduce((prevTransitionRevenue, marketOrderList) => {
    const transitionRevenue = computeTransitionRevenue(prevTransitionRevenue, marketOrderList);
    return transitionRevenue;
  }, endownment);
  return totalRevenue;
}

function sampleEndownments(transitionsOrders: Array < Array < [number, number] >> ) {
  const endownments = [0.1, 0.2, 1, 5, 100, 1000];
  return endownments.map((endownment) => {
    let revenue;
    try {
      revenue = computeTotalRevenue(endownment, transitionsOrders);
    } catch (e) {
      revenue = NaN;
    }
    return {
      endownment,
      revenue,
    };
  });
}

export async function getCycle(req: Request, res: Response, next: NextFunction) {
  try {
    const cycleId = req.params.cycleId;
    if (!cycleId) {
      throw new Error("no cycle id provided");
    }

    const transitions = deserializeCycle(cycleId);
    const orderbooks = await Promise.all(transitions.map(Orderbook.getOrderbookForTransition));
    const marketOrders = orderbooks.map(([orderbook, askOrBid], index) => {
      return getOrdersInTransitionSellCurrency(orderbook, askOrBid);
    });
    const endownmentsAndRevenues = sampleEndownments(marketOrders);

    res.json({cycleId, endownmentsAndRevenues, marketOrders});
    // magic number 1 = endownmnet
  } catch (e) {
    next(e);
  }
}
