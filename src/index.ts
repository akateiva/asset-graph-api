import * as AssetGraph from './models/AssetGraph';
import * as AssetGraphController from './controllers/AssetGraph.controller'
import DataSource from './DataSource';
import Server from './Server';

async function main(){
  console.log('starting')
  const server = new Server();

  const graph = new AssetGraph.Graph();
  AssetGraphController.setDefaultGraph(graph);
  
  console.log('making data source')
  const dataSource = new DataSource();
  await dataSource.connect();
  console.log('getting latest tickers')
  const tickers = await dataSource.getLatestMarketTickers();
  for (let ticker of tickers){
    graph.processMarketTicker(ticker);
  }
  
  dataSource.subscribeToNewTickers((ticker) => {
    graph.processMarketTicker(ticker);
  });

  console.log('graph constructedd');
  console.log('vertex count', graph.getVertexCount(), 'edge count', graph.getEdgeCount());
  
  await server.listen(4000);
  console.log('adding controller routes')

  
  server.app.get('/arbitrage/triangles/:baseAsset', AssetGraphController.getArbitrageTriangles)
  server.app.get('/exchangeRate/:sell/:buy', AssetGraphController.getExchangeRate)
}

main();
