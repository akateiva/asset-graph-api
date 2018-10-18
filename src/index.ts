import {Observable} from 'rxjs';
import IMarketTicker from './IMarketTicker';
import DataSource from './DataSource'
import * as Graph from './AssetGraph2';


async function main(){
  console.log('starting')
  const graph = new Graph.Graph();
  console.log('making data source')
  const dataSource = new DataSource("mongodb://localhost:27017");
  await dataSource.connect();
  console.log('getting latest tickers')
  const tickers = await dataSource.getLatestMarketTickers();
  for (let ticker of tickers){
    graph.processMarketTicker(ticker);
  }
  console.log('graph constructedd');
  console.log('vertex count', graph.getVertexCount());

  // real shit starts here
  const usdt = graph.getVertexByAsset({symbol: "BTC"});
  const usd = graph.getVertexByAsset({symbol: "USDT"});
  const path = graph.findShortestPath(usdt, usd);
  console.log(graph.getPathExchangeRate(path))

}

main();
