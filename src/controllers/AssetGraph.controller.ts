import {
  Request,
  Response
} from 'express';
import * as AssetGraph from '../models/AssetGraph';

var DEFAULT_GRAPH: AssetGraph.Graph;

export function setDefaultGraph(graph: AssetGraph.Graph) {
  DEFAULT_GRAPH = graph;
}

interface IGetArbitrageTrianglesResponse {
  ok: boolean;
  msg: string;
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
  const baseAsset = req.params.baseAsset;
  var result: IGetArbitrageTrianglesResponse = {
    ok: false,
    msg: "",
    cycles: [],
  };

  // TODO: do not upsert these nodes
  const baseAssetVertex = DEFAULT_GRAPH.getVertexByAsset({
    symbol: baseAsset
  })


  const arbitrageCycles = DEFAULT_GRAPH.findArbitrageTriangles(baseAssetVertex);

  result.ok = true;
  result.cycles = arbitrageCycles.map((cycle) => {
    return {
      rate: cycle.rate,
      trades: cycle.transitions.map((transition) => {
        return {
          sell: transition.edge.start.asset.symbol,
          buy: transition.edge.end.asset.symbol,
          exchange: transition.pair.exchange,
          lastPrice: transition.pair.basePrice,
          lastPriceDate: new Date()
        }
      })
    }
  })


  res.json(result);
}
