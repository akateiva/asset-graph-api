import {
  IAsset,
  AssetSymbol,
  Edge,
  IMarketTicker,
  Logger,
  IMarketPair,
  Path,
  Vertex,
} from "./index";

export default class Graph {
  private vertices: Map < AssetSymbol, Vertex > = new Map < AssetSymbol, Vertex > ();
  private edges: Map < string, Edge > = new Map < string, Edge > ();

  public getVertexByAsset(asset: IAsset, upsert = false): Vertex | undefined {
    let vertex = this.vertices.get(asset.symbol);
    if (!vertex && upsert) {
      vertex = new Vertex(asset);
      this.vertices.set(asset.symbol, vertex);
      Logger.trace("getVertexByAsset: upserted vertex for %s", asset.symbol);
    }
    return vertex;
  }

  public getEdgeBySymbols(start: string, end: string): Edge | undefined {
    return this.edges.get(start + "-" + end);
  }

  public getEdge(start: Vertex, end: Vertex, upsert = false): Edge | undefined {
    let edge = this.getEdgeBySymbols(start.asset.symbol, end.asset.symbol);
    if (!edge && upsert) {
      edge = new Edge(start, end);
      const reverseEdge = new Edge(end, start, edge.pairs);
      this.edges.set(edge.getHash(), edge);
      this.edges.set(reverseEdge.getHash(), reverseEdge);
      Logger.trace("getEdge: upserted edges between %s and %s", start.asset.symbol, end.asset.symbol);
    }
    return edge;
  }

  public getAvailableAssetSymbols(): string[] {
    return Array.from(this.vertices.keys());
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
      symbol: ticker.BaseCurrency,
    }, true) !;
    const marketAssetVertex = this.getVertexByAsset({
      symbol: ticker.MarketCurrency,
    }, true) !;

    const baseToMarketEdge = this.getEdge(baseAssetVertex, marketAssetVertex, true) !;
    baseToMarketEdge.upsertMarketPair({
      base: baseAssetVertex.asset,
      market: marketAssetVertex.asset,
      basePrice: ticker.Last,
      baseVolume: ticker.BaseVolume,
      exchange: ticker.Exchange,
      date: ticker.WriteDate,
      askPrice: ticker.Ask,
      bidPrice: ticker.Bid,
    });
  }
}
