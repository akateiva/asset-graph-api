import AStar from './AStar';
import * as DataSource from './DataSource';
import IMarketTicker from './IMarketTicker';


export type Path = PathSegment[];

export interface PathSegment {
  from: GraphNode,
  to: GraphNode,
  exchangeRate: number
}

export class GraphEdge {
  baseAsset: GraphNode;
  marketAsset: GraphNode;
  price: number;
  volume: number;

  constructor(baseAsset: GraphNode, marketAsset: GraphNode, price: number, volume: number){
    this.baseAsset = baseAsset;
    this.marketAsset = marketAsset;
    this.price = price;
    this.volume = volume;
    baseAsset.edges.push(this);
    marketAsset.edges.push(this);
  }
}

export class GraphNode {
  assetSymbol: string;
  edges: GraphEdge[];

  constructor(assetSymbol: string){
    this.assetSymbol = assetSymbol;
    this.edges = [];
  }

  public get neigbors(): GraphNode[] {
    return this.edges.map((edge) => {
      if(this === edge.baseAsset){
        return edge.marketAsset;
      }
      return edge.baseAsset;
    })
  }

  public findPathTo(goal: GraphNode) : Path {
    return AStar(this, goal);
  }

  public findExchangeRate(targetAsset: GraphNode): number {
    const path = this.findPathTo(targetAsset);
    console.log(path)
    var rate = 1;
    for(let pathSegment of path){
      rate*=pathSegment.exchangeRate;
    }
    return rate;
  }
}

export class AssetGraph {
  private nodes: {[assetSymbol: string]: GraphNode} = {};

  public getNodeByAssetSymbol(assetSymbol: string){
    if(!(assetSymbol in this.nodes)){
      this.nodes[assetSymbol] = new GraphNode(assetSymbol);
    }
    return this.nodes[assetSymbol];
  }

  public addMarket(ticker: IMarketTicker){
    //find nodes for market and base asset nodes
    const baseAsset = this.getNodeByAssetSymbol(ticker.BaseCurrency);
    const marketAsset = this.getNodeByAssetSymbol(ticker.MarketCurrency);
    
    const edge = new GraphEdge(baseAsset, marketAsset,ticker.Last,ticker.BaseVolume);
  }
}
