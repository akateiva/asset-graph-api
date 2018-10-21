import {Edge, Asset} from './index';

export default class Vertex {
  public asset: Asset;
  public edges: Edge[] = [];

  constructor(asset: Asset) {
    this.asset = asset;
  }

  public getNeighbors(): Vertex[] {
    return this.edges.map((edge) => edge.end);
  }
  /*
  public getNeighborsThroughExchanges(exchanges: Exchange[]){
    return this.edges.
      fil
  }
   */
}


