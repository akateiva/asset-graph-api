import IMarketTicker from './IMarketTicker';
import pino from 'pino';

const logger = pino({
  name: 'AssetGraph2',
  level: 'debug'
});

export type AssetSymbol = string;

export interface Asset {
  symbol: AssetSymbol
}

/*
interface Exchange {
  name: string
}*/

export type Exchange = string;

export type Path = Edge[];

export interface MarketPair {
  exchange: Exchange
  base: Asset 
  market: Asset
  basePrice: number
  baseVolume: number
}

// directed edge
export class Edge {
  public start: Vertex;
  public end: Vertex;
  public pairs: Map < Exchange, MarketPair > = new Map < Exchange, MarketPair > ();

  constructor(start: Vertex, end: Vertex) {
    this.start = start;
    this.end = end;
    start.edges.push(this);
  }

  public averageExchangeRate() : number{
    var numerator = 0;
    var denominator = 0;
    for (let marketPair of this.pairs.values()){
      if(marketPair.market === this.start.asset){
        numerator += marketPair.baseVolume * marketPair.basePrice;
        denominator += marketPair.baseVolume;
      }else{
        numerator = 1/(marketPair.basePrice * marketPair.baseVolume);;
        denominator += 1/marketPair.baseVolume;
      }
    }
    return numerator/denominator;
  }
}

export class Vertex {
  public asset: Asset;
  public edges: Edge[] = [];

  constructor(asset: Asset) {
    this.asset = asset;
  }

  public getNeighbors(): Vertex[]{
    return this.edges.map((edge) => edge.end);
  }
}


export interface IConversionResult {
  from: string;
  to: string;
  rate: number;
  via: {
    marketPair: MarketPair;
  }[]
}

export class Graph {
  private vertices: Map < AssetSymbol, Vertex > = new Map < AssetSymbol, Vertex > ();
  //private edges: Map<Vertex, Edge[]> = new Map<Vertex, Edge[]>();

  /**
   * returns a graph vertex for a particular asset
   *
   * @returns {Vertex} the vertex that represents the asset
   */
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

  private reconstructPath(start: Vertex, end: Vertex, cameFrom: Map<Vertex, Vertex>): Path{
    var current = end;
    var path: Path = [];
    while(cameFrom.has(current)){
      const from = cameFrom.get(current)!;
      //TODO: camefrom save edges
      const to = current;
      current = from;
      const viaEdge: Edge = from.edges.find((edge) => edge.end === to)!;
      path.unshift(viaEdge)
      if(current === start) break;
    }
    return path;
  }


  public findShortestPath(start: Vertex, end: Vertex): Path {
    const closedSet: Vertex[] = [];
    const openSet: Vertex[] = [start];
    const cameFrom = new Map < Vertex, Vertex > ();
    const gScore = new Map < Vertex, number > ();
    const fScore = new Map < Vertex, number > ();
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

  public getPathExchangeRate(path: Path) : IConversionResult{
    var rate = 1;

    path.forEach((edge) => {
      const edgeRate = edge.averageExchangeRate();
      logger.trace("%d %s -> %d %s rate: %d", rate, edge.start.asset.symbol, rate*edgeRate, edge.end.asset.symbol, edgeRate);
      //console.log(edge);
      //console.log(edgeRate)
      rate *= edgeRate;
    })
    var result: IConversionResult = {
      from: path[0].start.asset.symbol,
      to: path[path.length-1].end.asset.symbol,
      rate,
      via: []
    }
    return result;
  }
}

/*
const testGraph = new Graph();
testGraph.processMarketTicker({"Name":"USDT-BTC","Last":6728.13,"BaseVolume":139944703.85608774,"ReceivedOn": new Date(),"MarketCurrency":"BTC","BaseCurrency":"USDT","Exchange":"Binance","Ask":6728.13,"Bid":6725.84,"WriteDate": new Date()});
testGraph.processMarketTicker({"Name":"USDT-BTC","Last":0.0001486297084,"BaseVolume":20799,"ReceivedOn": new Date(),"MarketCurrency":"USDT","BaseCurrency":"BTC","Exchange":"Binance","Ask":0.0001486297084,"Bid":0.0001486297084,"WriteDate": new Date()});
   */
