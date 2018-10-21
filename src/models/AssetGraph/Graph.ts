import {Edge, Vertex, AssetSymbol, IMarketTicker, Path,  Asset, IAssetTransition, IArbitrageCycle, IConversionResult} from './index';

import pino from 'pino';

const logger = pino({
  name: 'AssetGraph2',
  level: 'debug'
});

function getTransitionExchangeRate(transition: IAssetTransition) {
  if (transition.pair.market === transition.edge.start.asset) {
    return transition.pair.basePrice;
  } else {
    return 1 / transition.pair.basePrice;
  }
}

export default class Graph {
  private vertices: Map < AssetSymbol, Vertex > = new Map < AssetSymbol, Vertex > ();

  public getVertexByAsset(asset: Asset): Vertex {
    var vertex = this.vertices.get(asset.symbol);
    if (!vertex) {
      vertex = new Vertex(asset);
      this.vertices.set(asset.symbol, vertex);
      logger.trace("getVertexByAsset: created vertex for %s", asset.symbol);
    }
    return vertex;
  }

  public getVertexCount(): number {
    return this.vertices.size;
  }

  public processMarketTicker(ticker: IMarketTicker) {
    // get vertices. if they dont exist, they will be created by getVertexByAsset
    const baseAssetVertex = this.getVertexByAsset({
      symbol: ticker.BaseCurrency
    });
    const marketAssetVertex = this.getVertexByAsset({
      symbol: ticker.MarketCurrency
    });

    // get the edge of this exchange between these vertices
    // since its an undirected graph, only one vertex neighbors are required
    var baseToMarketEdge = baseAssetVertex.edges.find((edge) => edge.end === marketAssetVertex);
    var marketToBaseEdge = marketAssetVertex.edges.find((edge) => edge.end === baseAssetVertex);
    if (!baseToMarketEdge || !marketToBaseEdge) {
      //create edges
      baseToMarketEdge = new Edge(baseAssetVertex, marketAssetVertex);
      marketToBaseEdge = new Edge(marketAssetVertex, baseAssetVertex);
      logger.trace("processMarketTicker: created edges between %s and %s", ticker.BaseCurrency, ticker.MarketCurrency);
    }

    // even though we get the market pair from baseToMarket edge, marketToEdge contains the reference
    // to the same market pair object, so they be in syncc
    var exchangePair = baseToMarketEdge.pairs.get(ticker.Exchange);
    if (!exchangePair) {

      exchangePair = {
        base: baseAssetVertex.asset,
        market: marketAssetVertex.asset,
        basePrice: ticker.Last,
        baseVolume: ticker.BaseVolume,
        exchange: ticker.Exchange
      }
      baseToMarketEdge.pairs.set(ticker.Exchange, exchangePair);
      marketToBaseEdge.pairs.set(ticker.Exchange, exchangePair);
      logger.trace({
        exchangePair
      }, "processMarketTicker: created exchange pair for %s - %s at %s", ticker.BaseCurrency, ticker.MarketCurrency, ticker.Exchange);
    } else {
      exchangePair.basePrice = ticker.Last;
      exchangePair.baseVolume = ticker.BaseVolume;
      logger.trace({
        exchangePair
      }, "processMarketTicker: updated exchange pair for %s - %s at %s", ticker.BaseCurrency, ticker.MarketCurrency, ticker.Exchange);
    }
  }

  private reconstructPath(start: Vertex, end: Vertex, cameFrom: Map < Vertex, Vertex > ): Path {
    var current = end;
    var path: Path = [];
    while (cameFrom.has(current)) {
      const from = cameFrom.get(current) !;
      //TODO: camefrom save edges
      const to = current;
      current = from;
      const viaEdge: Edge = from.edges.find((edge) => edge.end === to) !;
      path.unshift(viaEdge)
      if (current === start) break;
    }
    return path;
  }


  public findShortestPath(start: Vertex, end: Vertex): Path {
    const closedSet: Vertex[] = [];
    const openSet: Vertex[] = [start];
    const cameFrom = new Map < Vertex,
      Vertex > ();
    const gScore = new Map < Vertex,
      number > ();
    const fScore = new Map < Vertex,
      number > ();
    fScore.set(start, 1);

    while (openSet.length > 0) {
      //current := the node in openSet having the lowest fScore[] value
      const openSetFScores = openSet.map((node) => fScore.get(node) || Infinity);
      const current = openSet[openSetFScores.indexOf(Math.min(...openSetFScores))];

      if (current === end) {
        //return reconstructPath(start, end, cameFrom);
        return this.reconstructPath(start, end, cameFrom);
      }

      openSet.splice(openSet.indexOf(current), 1);
      closedSet.push(current);

      for (let neighbor of current.getNeighbors()) {
        if (closedSet.indexOf(neighbor) > 0) continue;
        const tentative_gScore = (gScore.get(current) || Infinity) + 1;

        if (openSet.indexOf(neighbor) < 0) {
          openSet.push(neighbor)
        } else if (tentative_gScore >= (gScore.get(neighbor) || Infinity)) {
          continue;
        }

        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative_gScore);
        fScore.set(neighbor, (gScore.get(neighbor) || Infinity) + 1);
      }
    }

    return [];
  }

  public getPathExchangeRate(path: Path): IConversionResult {
    var rate = 1;

    path.forEach((edge) => {
      const edgeRate = edge.averageExchangeRate();
      logger.trace("%d %s -> %d %s rate: %d", rate, edge.start.asset.symbol, rate * edgeRate, edge.end.asset.symbol, edgeRate);
      rate *= edgeRate;
    })
    var result: IConversionResult = {
      from: path[0].start.asset.symbol,
      to: path[path.length - 1].end.asset.symbol,
      rate,
      via: []
    }
    return result;
  }

  private findTransitions(vertex: Vertex): IAssetTransition[] {
    return vertex.edges.reduce((transitions: IAssetTransition[], edge) => {
      return transitions.concat(...Array.from(edge.pairs.values()).map((pair) => {
        return {
          edge,
          pair
        }
      }))
    }, [] as IAssetTransition[])
  }

  public findArbitrageTriangles(vertex: Vertex): IArbitrageCycle[] {
    const firstOrderTransitions = this.findTransitions(vertex);
    return firstOrderTransitions.reduce((acc: IArbitrageCycle[], firstOrderTransition) => {
      const firstOrderRate = getTransitionExchangeRate(firstOrderTransition);
      const secondOrderTransitions = this.findTransitions(firstOrderTransition.edge.end)
      secondOrderTransitions.forEach((secondOrderTransition) => {
        const secondOrderRate = getTransitionExchangeRate(secondOrderTransition);
        //make sure third order transition
        const thirdOrderTransitions = this.findTransitions(secondOrderTransition.edge.end)
          .filter((transition) => transition.edge.end === vertex)
        thirdOrderTransitions.forEach((thirdOrderTransition) => {
          const thirdOrderRate = getTransitionExchangeRate(thirdOrderTransition);
          const cycleRate = firstOrderRate * secondOrderRate * thirdOrderRate
          if (cycleRate >= 1.005) {
            acc.push({
              rate: cycleRate,
              transitions: [firstOrderTransition, secondOrderTransition, thirdOrderTransition]
            })
          }
        })
      })
      return acc;
    }, [])
  }
}
