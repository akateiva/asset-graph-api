import {IAsset, Edge, ITransition} from "./index";

export default class Vertex {
  public asset: IAsset;
  public edges: Edge[] = [];

  constructor(asset: IAsset) {
    this.asset = asset;
  }

  public getNeighbors(): Vertex[] {
    return this.edges.map((edge) => edge.end);
  }

  public getTransitions(): ITransition[] {
    const transitions: ITransition[] = [];
    for ( const edge of this.edges) {
      transitions.push(... edge.getTransitions());
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
