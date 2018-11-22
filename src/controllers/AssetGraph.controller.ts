import {
  Request,
  Response,
  NextFunction,
} from "express";
import {ITransition, AssetSymbol, Edge, Exchange, Graph, IAsset,
  IMarketPair, IMarketTicker, Transition, Vertex} from "../models/AssetGraph";
import * as Orderbook from "../models/Orderbook";
import Logger from "../util/logger";
import { Observable } from "rxjs";
import * as Bluebird from "bluebird";

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
  rateThreshold: number;
  endownment: number;
}

function getOrderbookForTransition(t: Transition): Promise<Orderbook.IOrderBook> {
  return Orderbook.getOrderbookForTransition(t).then((o) => o[0]);
}

async function getOrderbookBasedRate(ab: Transition, bc: Transition, ca: Transition, endownment: number): Promise<number> {
  const transitions = [ab, bc, ca];
  const orderbooks = await Promise.all(transitions.map((t) => getOrderbookForTransition(t)));

  const marketOrders = transitions.map((t, idx) => {
    if (t.positionType === "long") {
      return orderbooks[idx].asks.map(([price, amount]) => [1 / price, amount * price] as [number, number]);
    } else {
      return orderbooks[idx].bids;
    }
  });

  const margin = computeTotalRevenue(0.001, marketOrders) / 0.001;
  return margin;
}

function evaluateEdges(opts: ITransitionFilterOptions, ab: Edge, bc: Edge, ca: Edge)
  : Array<Promise<CycleSearchResult.ICycle|undefined>> {
  const transitionEvaluationPromises: Array<Promise<CycleSearchResult.ICycle|undefined>> = [];

  for ( const t1 of ab.getTransitions(() => true)) {
    if ( opts.startingExchange && t1.marketPair.exchange !== opts.startingExchange ) { continue; }
    if ( opts.exchanges && opts.exchanges.indexOf(t1.marketPair.exchange) === -1) { continue; }
    if ( t1.volumeInSellCurrency < opts.minimumVolume) { continue; }
    for ( const t2 of bc.getTransitions(() => true)) {
      if ( opts.exchanges && opts.exchanges.indexOf(t2.marketPair.exchange) === -1) { continue; }
      if ( t2.volumeInSellCurrency / ( t1.unitCost )  <= opts.minimumVolume ) { continue; }
      for ( const t3 of ca.getTransitions(() => true)) {
        if ( opts.exchanges && opts.exchanges.indexOf(t3.marketPair.exchange) === -1) { continue; }
        if ( t3.volumeInSellCurrency / ( t1.unitCost * t2.unitCost )  <= opts.minimumVolume ) { continue; }
        const tickerRate = t1.unitCost * t2.unitCost * t3.unitCost;
        transitionEvaluationPromises.push(getOrderbookBasedRate(t1, t2, t3, opts.endownment).then((orderbookRate) => {
          logger.debug({tickerRate,
            orderbookRate,
            abHash: ab.getHash(),
            bc: bc.getHash(),
            ca: ca.getHash(),
            abExchange: t1.marketPair.exchange,
            bcExchange: t2.marketPair.exchange,
            caExchange: t3.marketPair.exchange,
          }, "evaluated orderbook");
          const cycle = makeCycle(t1, t2, t3);
          cycle.maxRate = orderbookRate;
          return cycle;
        }, (error) => {
          logger.error(error);
          return undefined;
        }));
      }
    }
  }

  return transitionEvaluationPromises;
}

export async function findCycles(req: Request, res: Response, next: NextFunction) {
  let progressInterval: any;
  try {
    const baseAssetSymbol = req.body.baseAssetSymbol;
    const baseAssetVertex = Graph.getVertexByAsset({symbol: baseAssetSymbol});

    const filterOptions: ITransitionFilterOptions = { allowDifferentExchanges: true,
      minimumVolume: req.body.minimumVolume || 0,
      startingExchange: undefined,
      exchanges: req.body.exchanges || undefined,
      endownment: req.body.endownment || 0.1,
      rateThreshold: 0.8,
    };

    const neighbors = baseAssetVertex!.getNeighbors();
    req.log.info("Searching from %s , neighbor count: ", baseAssetSymbol, neighbors.length);
    const edgeEvaluationPromises: Array<Promise<CycleSearchResult.ICycle|undefined>> = [];
    let completedEdgeEvaluations = 0;
    res.writeHead(200, {"Content-Type": "text/event-stream"});
    for ( const neighborB of neighbors ) {
      for ( const neighborC of neighbors ) {
        // we know for sure that an edge from baseAsset to neighbors exits
        // but we need to check if neighbors are connectec too. this would form a triangle.
        const edgeBC = Graph.getEdgeBySymbols(neighborB.asset.symbol, neighborC.asset.symbol);
        if (!edgeBC) { continue; }
        const edgeAB = Graph.getEdgeBySymbols(baseAssetSymbol, neighborB.asset.symbol)!;
        const edgeCA = Graph.getEdgeBySymbols(neighborC.asset.symbol, baseAssetSymbol)!;
        evaluateEdges(filterOptions, edgeAB, edgeBC, edgeCA).forEach((edgeEvaluationPromise) => {
          edgeEvaluationPromise.then((cycles) => {
            completedEdgeEvaluations++;
            if (!cycles) { return; }
            if (cycles.maxRate > 1) {
              res.write("data: " + JSON.stringify(cycles) + "\n\n");
            }
            return cycles;
          }, (error) => {
            logger.error(error, "evaluation error");
          });
          edgeEvaluationPromises.push(edgeEvaluationPromise);
        });
      }
    }
    logger.info("awaiting %d edge evaluation promises", edgeEvaluationPromises.length);
    progressInterval = setInterval(() => {
      res.write(`data: progress ${completedEdgeEvaluations} ${edgeEvaluationPromises.length}\n\n`);
    }, 1000);
    await Promise.all(edgeEvaluationPromises);
  } catch (e) {
    req.log.error(e);
  }
  clearInterval(progressInterval);
  res.write("data: end\n\n\n");
  res.end();
  // res.json(result);
}

export function computeTransitionRevenue(endownment: number, orders: Array < [number, number] > ): number {
  let cost = 0;
  let revenue = 0;
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
      break;
    }
  }
  if (cost !== endownment) { revenue = 0; }

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
