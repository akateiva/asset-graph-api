import {
  Request,
  Response,
} from "express";
import * as AssetGraph from "../models/AssetGraph";

declare namespace ArbitrageSearchResult {
    export interface Trade {
        buy: string;
        sell: string;
        exchange: string;
        unitLastPrice: number;
        unitLastPriceDate: string;
        relativeVolume: number;
    }

    export interface Signal {
        maxRate: number;
        trades: Trade[];
    }

    export interface RootObject {
        took: number;
        timeExhausted: boolean;
        signals: Signal[];
    }
}

function getTransitionRate(...transitions: AssetGraph.ITransition[]): number {
  let rate = 1;
  for (const transition of transitions) {
    let transitionRate: number;
    if (transition.sell.asset === transition.marketPair.market) {
      transitionRate = transition.marketPair.bidPrice || transition.marketPair.basePrice;
    } else {
      transitionRate = 1 / ( transition.marketPair.askPrice || transition.marketPair.basePrice );
    }
    rate *= transitionRate; // * (1 - 0.0025);
  }
  return rate;
}

function makeSignal(...transitions: AssetGraph.ITransition[]): ArbitrageSearchResult.Signal {
  const signal: ArbitrageSearchResult.Signal = transitions.reduceRight((signal, transition) => {
    const transitionExchangeRate = getTransitionRate(transition);
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
  }, {maxRate: 1, trades: [] as ArbitrageSearchResult.Trade[]});

  return signal;
}

// todo: write a test
export function findArbitrageTriangles(req: Request, res: Response) {
  const started = new Date(); // record when the request started
  const baseAsset = req.params.baseAsset; // asset from which the cycle search will be performed
  const timeoutMs = 200; // maximum time the search can run for
  const signalRateThreshold = 1.01; // minimum rate for a signal to be generated; +1% in this case
  const result: ArbitrageSearchResult.RootObject = {signals: [], took: NaN, timeExhausted: false};
  if ( !baseAsset ) { throw new Error("no base asset provided"); }
  const baseVertex = AssetGraph.Graph.getVertexByAsset({symbol: baseAsset});
  if ( !baseVertex ) { throw new Error("no such asset in the graph"); }

  let combinationsExplored = 0;
  let timeExhausted = false;
  const timeout = setTimeout(() => { timeExhausted = true; }, timeoutMs);

  firstOrderLoop:
  for (const firstOrderTransition of baseVertex.getTransitions()) {
    for (const secondOrderTransition of firstOrderTransition.buy.getTransitions()) {
      if (firstOrderTransition.sell === secondOrderTransition.buy) { continue; }
      for (const thirdOrderTransition of secondOrderTransition.buy.getTransitions()) {
        combinationsExplored++;
        if (firstOrderTransition.sell !== thirdOrderTransition.buy) { continue; }
        if (timeExhausted) { break firstOrderLoop; }
        const rate = getTransitionRate(firstOrderTransition, secondOrderTransition, thirdOrderTransition);
        if (rate > signalRateThreshold) {
          result.signals.push(makeSignal(firstOrderTransition, secondOrderTransition, thirdOrderTransition));
        }
      }
    }
  }

  result.took = new Date().getTime() - started.getTime();
  result.timeExhausted = timeExhausted;
  res.json(result);
}
