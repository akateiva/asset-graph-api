import {
  Request,
  Response
} from 'express';
import * as AssetGraph from '../models/AssetGraph';
import * as ArbitrageSignal from "../models/ArbitrageSignal";

var DEFAULT_GRAPH: AssetGraph.Graph;

export function setDefaultGraph(graph: AssetGraph.Graph) {
  DEFAULT_GRAPH = graph;
}

interface IGetArbitrageTrianglesResponse {
  ok: boolean;
  msg: string;
  took: number;
  cycles: {
    rate: number;
    trades: {
      sell: string;
      buy: string;
      exchange: string;
      lastPrice: number;
      lastPriceDate: Date;
    }[];
  }[];
}

export function getArbitrageTriangles(req: Request, res: Response) {
  const start = new Date();
  const baseAsset = req.params.baseAsset;
  var result: IGetArbitrageTrianglesResponse = {
    ok: false,
    msg: "",
    cycles: [],
    took: 0
  };

  const signals = ArbitrageSignal.getArbitrageTriangleSignals(DEFAULT_GRAPH, baseAsset);
  result.ok = true;
  result.cycles = signals.map((signal) => {
    return {
      rate: signal.rate,
      trades: signal.transitions.map((transition) => {
        return {
          sell: transition.sell.asset.symbol,
          buy: transition.buy.asset.symbol,
          exchange: transition.marketPair.exchange,
          lastPrice : NaN,
          lastPriceDate: new Date()
        }
      })
    }
  })
  result.took = new Date().getTime() - start.getTime();
  res.json(result);
}

export function getExchangeRate(req: Request, res: Response){
  /*
  var result = {}
  const sellCurrency = req.params.sell;
  const buyCurrency = req.params.buy;

  const sellVertex = DEFAULT_GRAPH.getVertexByAsset({symbol: sellCurrency});
  const buyVertex = DEFAULT_GRAPH.getVertexByAsset({symbol: buyCurrency});
  const shortestPath = DEFAULT_GRAPH.findShortestPath(sellVertex, buyVertex);
  const rate = DEFAULT_GRAPH.getPathExchangeRate(shortestPath);

  res.json({rate: rate})
   */
}
