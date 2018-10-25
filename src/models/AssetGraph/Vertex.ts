import {Edge, Asset, ITransition} from './index';

export default class Vertex {
  public asset: Asset;
  public edges: Edge[] = [];

  constructor(asset: Asset) {
    this.asset = asset;
  }

  public getNeighbors(): Vertex[] {
    return this.edges.map((edge) => edge.end);
  }

  public getTransitions(): ITransition[] {
    var transitions: ITransition[] = [];
    for( let edge of this.edges){
      for (let marketPair of edge.pairs.values()){
        transitions.push({
          sell: this,
          buy: edge.end,
          edge,
          marketPair
        })
      }
    }
    return transitions;
  }
  /*
  public getTransitions(): IAssetTransition[] {
    return this.edges.reduce((transitions, edge) => {
      return transitions.concat(... Array.from(edge.pairs.values()).map((pair => {
        return {
          edge,
          pair,
        };
      })))
    }, [] as IAssetTransition[]);
  }
   */
  /*
  public getNeighborsThroughExchanges(exchanges: Exchange[]){
    return this.edges.
      fil
  }
   */
}


