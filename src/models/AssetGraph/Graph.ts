import {
  Edge,
  Vertex,
  AssetSymbol,
  IMarketTicker,
  Path,
  Asset,
  MarketPair
} from './index';

import pino from 'pino';

const logger = pino({
  name: 'AssetGraph2',
  level: 'trace'
});

export default class Graph {
  private vertices: Map < AssetSymbol, Vertex > = new Map < AssetSymbol, Vertex > ();
  private edges: Map < string, Edge > = new Map < string, Edge > ();

  public getVertexByAsset(asset: Asset, upsert = false): Vertex | undefined {
    var vertex = this.vertices.get(asset.symbol);
    if (!vertex && upsert) {
      vertex = new Vertex(asset);
      this.vertices.set(asset.symbol, vertex);
      logger.trace("getVertexByAsset: upserted vertex for %s", asset.symbol);
    }
    return vertex;
  }

  public getEdge(start: Vertex, end: Vertex, upsert = false): Edge | undefined {
    var edge = this.edges.get(start.asset.symbol + '-' + end.asset.symbol);
    if (!edge && upsert) {
      edge = new Edge(start, end);
      let reverseEdge = new Edge(end, start, edge.pairs);
      this.edges.set(edge.getHash(), edge);
      this.edges.set(reverseEdge.getHash(), reverseEdge);
      logger.trace("getEdge: upserted edges between %s and %s", start.asset.symbol, end.asset.symbol);
    }
    return edge;
  }

  public getVertexCount(): number {
    return this.vertices.size;
  }

  public getEdgeCount(): number {
    return this.edges.size;
  }

  public processMarketTicker(ticker: IMarketTicker) {
    // get vertices. if they dont exist, they will be created by getVertexByAsset
    const baseAssetVertex = this.getVertexByAsset({
      symbol: ticker.BaseCurrency
    }, true) !;
    const marketAssetVertex = this.getVertexByAsset({
      symbol: ticker.MarketCurrency
    }, true) !;

    var baseToMarketEdge = this.getEdge(baseAssetVertex, marketAssetVertex, true) !;
    baseToMarketEdge.upsertMarketPair({
      base: baseAssetVertex.asset,
      market: marketAssetVertex.asset,
      basePrice: ticker.Last,
      baseVolume: ticker.BaseVolume,
      exchange: ticker.Exchange,
      date: ticker.WriteDate,
    });
  }
}
