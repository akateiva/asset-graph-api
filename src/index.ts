import {Observable} from 'rxjs';
import IMarketTicker from './IMarketTicker';
import DataSource from './DataSource'
import * as Graph from './AssetGraph';


async function main(){
  console.log('starting')
  const graph = new Graph.AssetGraph();
  console.log('making data source')
  const dataSource = new DataSource("mongodb://localhost:27017");
  await dataSource.connect();
  console.log('getting symbols')
  const tickers = await dataSource.getLatestMarketTickers();
  for (let ticker of tickers){
    graph.addMarket(ticker);
  }
  console.log('graph constructedd');
  const usdt = graph.getNodeByAssetSymbol('GBP');
  const usd = graph.getNodeByAssetSymbol('EUR');
  const rate = usdt.findExchangeRate(usd);
  console.log(`${usdt.assetSymbol} - ${usd.assetSymbol} rate is ${rate}`);

}

main();
