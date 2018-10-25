function getTransitionExchangeRate(transition: IAssetTransition) {
  if (transition.pair.market === transition.edge.start.asset) {
    return transition.pair.basePrice;
  } else {
    return 1 / transition.pair.basePrice;
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




  public findArbitrageTriangles(baseAsset: Vertex): void {
    baseAsset.getTransitions().forEach((firstOrderTransition) => {
      
    })
  }


export interface IConversionResult {
  from: string;
  to: string;
  rate: number;
  via: {
    marketPair: MarketPair;
  }[]
}

export interface IAssetTransition {
  edge: Edge;
  pair: MarketPair;
}
export interface IArbitrageCycle {
  rate: number;
  transitions: IAssetTransition[];
}
