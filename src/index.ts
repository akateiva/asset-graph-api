import * as AssetGraph from './models/AssetGraph';
import * as AssetGraphController from './controllers/AssetGraph.controller'
import DataSource from './DataSource';
import Server from './Server';

async function main(){
  console.log('starting')
  const server = new Server();

  console.log('making data source')
  const dataSource = new DataSource();
  await dataSource.connect();
  console.log('getting latest tickers')
    /* TODO
  const tickers = await dataSource.getLatestMarketTickers();
  for (let ticker of tickers){
    graph.processMarketTicker(ticker);
  }
  
  dataSource.subscribeToNewTickers((ticker) => {
    graph.processMarketTicker(ticker);
  });
     */

  
  await server.listen(4000);
  console.log('adding controller routes')

  
  server.app.get('/arbitrage/triangles/:baseAsset', AssetGraphController.findArbitrageTriangles)
}

main();
