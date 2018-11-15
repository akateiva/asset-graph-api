import {
  Request,
  Response,
  NextFunction,
} from "express";
import {ITransition, AssetSymbol, Edge, Exchange, Graph, IAsset,
  IMarketPair, IMarketTicker, Transition, Vertex} from "../models/AssetGraph";
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

function serializeCycle(transitions: ITransition[]): string {
  return transitions.reduce((identifierString, transition) => {
    identifierString += `${transition.sell.asset.symbol},${transition.marketPair.exchange},`;
    return identifierString;
  }, "").slice(0, -1);
}

function deserializeCycle(id: string): ITransition[] {
  const idComponents = id.split(",");
  if (idComponents.length % 2 !== 0) {
    throw new Error("there must be an even number of id components");
  }
  const transitions: ITransition[] = [];
  for (let i = 0; i < idComponents.length; i += 2) {
    const sellAssetSymbol = idComponents[i];
    const buyAssetSymbol = idComponents[i + 2] || idComponents[0];
    const exchange = idComponents[i + 1];
    const edge = Graph.getEdgeBySymbols(sellAssetSymbol, buyAssetSymbol);
    if (!edge) {
      logger.error({ sellAssetSymbol, buyAssetSymbol, exchange}, "could not find edge");
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

function makeCycle(...transitions: ITransition[]): CycleSearchResult.ICycle {
  const cycle: CycleSearchResult.ICycle = transitions.reduce((signal, transition, transitionIndex) => {
    const trade = {
      buy: transition.buy.asset.symbol,
      sell: transition.sell.asset.symbol,
      exchange: transition.marketPair.exchange,
      unitLastPrice: transition.unitCost,
      volumeInSellCurrency: transition.volumeInSellCurrency,
      unitLastPriceDate: transition.marketPair.date.toISOString(),
      relativeVolume: transition.volumeInSellCurrency / signal.maxRate,
    };
    signal.trades.push(trade);
    signal.maxRate *= trade.unitLastPrice;
    return signal;
  }, {
    trades: [] as CycleSearchResult.ITrade[],
    id: serializeCycle(transitions),
    maxRate: 1,
  });

  return cycle;
}

interface ITransitionFilterOptions {
  startingExchange: string | undefined;
  allowDifferentExchanges: boolean;
  minimumVolume: number;
  exchanges: string[] | undefined;
}

// TODO: Write test
export function candidateTransitionFilter(opts: ITransitionFilterOptions,
                                          previousTransitions: ITransition[],
                                          e: Edge,
                                          m: IMarketPair): boolean {

  if (previousTransitions.length === 0) {
    if (opts.startingExchange) {
      if (opts.startingExchange !== m.exchange) { return false; }
    }
  } else {
    if (!opts.allowDifferentExchanges) {
      if (previousTransitions[previousTransitions.length - 1].marketPair.exchange !== m.exchange) {
        return false;
      }
    }
  }
  const candidateTransitionVolumeInSellCurrency = (m.market === e.start.asset) ? m.baseVolume / m.basePrice : m.baseVolume; 
  const relativeTransitionVolume = previousTransitions.reduce((a, t) => a *= t.unitCost, candidateTransitionVolumeInSellCurrency);
                                            //if (relativeTransitionVolume < opts.minimumVolume) { return false; }
  if (opts.exchanges) {
    if (opts.exchanges.indexOf(m.exchange) < 0) { return false;  }
  }
  return true;
}

// TODO: validate input
export function findCyclesOld(req: Request, res: Response, next: NextFunction) {
  const started = new Date(); // record when the request started
  const baseAsset = req.body.baseAssetSymbol; // asset from which the cycle search will be performed
  const timeoutMs = 200; // maximum time the search can run for
  const signalRateThreshold = 1.01; // minimum rate for a signal to be generated; +1% in this case
  const size = Infinity; // the maximum number of cycles to return
  // const exchangeFilter: string[] = req.query.exchanges.split(',') || undefined;
  const result: CycleSearchResult.IRootObject = {
    cycles: [],
    took: NaN,
    timeExhausted: false,
  };
  if (!baseAsset) { throw new Error("no base asset provided"); }
  const baseVertex = Graph.getVertexByAsset({symbol: baseAsset});
  if (!baseVertex) { throw new Error("no such asset in the graph"); }

  let combinationsExplored = 0;
  let timeExhausted = false;
  const timeout = setTimeout(() => {
    timeExhausted = true;
  }, timeoutMs);

  const filterOptions: ITransitionFilterOptions = { allowDifferentExchanges: true,
    minimumVolume: req.body.minimumVolume || 0,
    startingExchange: undefined,
    exchanges: req.body.exchanges || undefined,
  };

  const filterProvider = candidateTransitionFilter.bind(null, filterOptions);

  firstOrderLoop:
    for (const firstOrderTransition of baseVertex.getTransitions(filterProvider.bind(null, []))) {
      for (const secondOrderTransition of firstOrderTransition.buy
          .getTransitions( filterProvider.bind(null, [firstOrderTransition ]) )) {
        if (firstOrderTransition.sell === secondOrderTransition.buy) {
          continue;
        }
        for (const thirdOrderTransition of secondOrderTransition.buy
            .getTransitions( filterProvider.bind(null, [firstOrderTransition, secondOrderTransition]) )) {
          combinationsExplored++;
          if (firstOrderTransition.sell !== thirdOrderTransition.buy) {
            continue;
          }
          const rate = firstOrderTransition.unitCost * secondOrderTransition.unitCost * thirdOrderTransition.unitCost;
          if (rate > signalRateThreshold) {
            result.cycles.push(makeCycle(firstOrderTransition, secondOrderTransition, thirdOrderTransition));
          }
          if (timeExhausted || result.cycles.length >= size) {
            break firstOrderLoop;
          }
        }
      }
    }

  result.took = new Date().getTime() - started.getTime();
  result.timeExhausted = timeExhausted;
  res.json(result);
}

function evaluateTransitionTriangle(opts: ITransitionFilterOptions, baseToLeft: Transition[],
                                    leftToRight: Transition[], rightToBase: Transition[]) {

  const cycles: CycleSearchResult.ICycle[] = [];
  for ( const t1 of baseToLeft ) {
    if ( opts.startingExchange && t1.marketPair.exchange !== opts.startingExchange ) { continue; }
    if ( opts.exchanges && opts.exchanges.indexOf(t1.marketPair.exchange) === -1) { continue; }
    for ( const t2 of leftToRight ) {
      if ( opts.exchanges && opts.exchanges.indexOf(t2.marketPair.exchange) === -1) { continue; }
      for ( const t3 of rightToBase) {
        if ( opts.exchanges && opts.exchanges.indexOf(t3.marketPair.exchange) === -1) { continue; }
        const totalRate = t1.unitCost * t2.unitCost * t3.unitCost;
        if (totalRate > 1.010) {
          cycles.push(makeCycle(t1, t2, t3));
        }
      }
    }
  }
  return cycles;
}

export function findCycles(req: Request, res: Response, next: NextFunction) {
  const baseAssetSymbol = req.body.baseAssetSymbol;
  const baseAssetVertex = Graph.getVertexByAsset({symbol: baseAssetSymbol});

  const filterOptions: ITransitionFilterOptions = { allowDifferentExchanges: true,
    minimumVolume: req.body.minimumVolume || 0,
    startingExchange: undefined,
    exchanges: req.body.exchanges || undefined,
  };

  const filterProvider = candidateTransitionFilter.bind(null, filterOptions);

  const result: CycleSearchResult.IRootObject = {
    took: 1337,
    timeExhausted: false,
    cycles: [],
  };

  const neighbors = baseAssetVertex!.getNeighbors();
  req.log.info("Searching from %s , neighbor count: ", baseAssetSymbol, neighbors.length);
  for ( const neighborLeft of neighbors ) {
    for ( const neighborRight of neighbors ) {
      // we know for sure that an edge from baseAsset to neighbors exits
      // but we need to check if neighbors are connectec too. this would form a triangle.
      const edgeLeftToRigth = Graph.getEdgeBySymbols(neighborLeft.asset.symbol, neighborRight.asset.symbol);
      if (!edgeLeftToRigth) { continue; }
      const edgeBaseToLeft = Graph.getEdgeBySymbols(baseAssetSymbol, neighborLeft.asset.symbol)!;
      const edgeRightToBase = Graph.getEdgeBySymbols(neighborRight.asset.symbol, baseAssetSymbol)!;
      const tsBaseToLeft = edgeBaseToLeft.getTransitions(() => true);
      const tsLeftToRight = edgeLeftToRigth.getTransitions(() => true);
      const tsRightToBase = edgeRightToBase.getTransitions(() => true);
      result.cycles.push(... evaluateTransitionTriangle(filterOptions, tsBaseToLeft, tsLeftToRight, tsRightToBase));
    }
  }
  res.json(result);
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
  const endownments = [0.01, 0.05, 0.1, 0.2, 0.5, 1, 5, 10, 100, 1000];
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
    const tickerBasedUnitPrices = transitions.map((t) => t.unitCost);
    const orderbooks = await Promise.all(transitions.map((t) => {
      return Orderbook.getOrderbookForTransition(t).then((r) => r[0]);
    }));
    const marketOrders = orderbooks.map((orderbook, index) => {
      const transition = transitions[index];
      if (transition.positionType === "short") {
        return orderbook.bids;
      } else {
        return orderbook.asks.map(([price, amount]) => [1 / price, amount * price] as [number, number]);
      }
    });
    const endownmentsAndRevenues = sampleEndownments(marketOrders);

    res.json({cycleId, endownmentsAndRevenues, marketOrders, tickerBasedUnitPrices});
    // magic number 1 = endownmnet
  } catch (e) {
    next(e);
  }
}

export function getAvailableAssetSymbols(req: Request, res: Response) {
  return res.json({availableSymbols: Graph.getAvailableAssetSymbols()});
}
