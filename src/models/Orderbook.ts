import ccxt from "ccxt";
import Logger from "../util/logger";
import {
  ITransition,
} from "./AssetGraph";

const log = Logger.child({
  name: "Orderbook",
});

interface IExchangeModule {
  test: () => void;
  loadMarkets: () => Promise<void>;
  symbols: string[];
  fetchOrderBook: (marketSymbol: string) => Promise < IOrderBook > ;
}

interface IOrderBook {
  bids: Array<[number, number]>; // bid array sorted in ascending price [price,amount]
  asks: Array<[number, number]>; // ask array sorted in descending price [price, amount]
}

const exchangeModuleMap = new Map < string, IExchangeModule | Promise <IExchangeModule> > ();

async function getExchangeModuleForTransition(transition: ITransition): Promise < IExchangeModule > {
  let exchangeName = transition.marketPair.exchange.toLowerCase();

  // TODO: fix inconsistent exchange identifiers
  if (exchangeName === "huobi") { exchangeName = "huobipro"; }

  let exchangeModule = exchangeModuleMap.get(exchangeName);
  if (!exchangeModule) {
    try {
      log.debug("getExchangeModuleForTransition: constructing new ccxt exchange module for %s", exchangeName);
      exchangeModule = (async () => {
        // @ts-ignore
        const ccxtModule = new ccxt[exchangeName]() as IExchangeModule;
        await ccxtModule.loadMarkets();
        return ccxtModule;
      })();
      exchangeModuleMap.set(exchangeName, exchangeModule);
      log.debug("getExchangeModuleForTransition: markets loaded for %s", exchangeName);
    } catch (error) {
      log.error(error);
      throw new Error(`failed to get exchange module for exchange "${exchangeName}"`);
    }
  }
  return exchangeModule;
}

function getMarketPairSymbolForTransition(transition: ITransition,
                                          exchangeModule: IExchangeModule): [string, "ask" | "bid"] {
  let pair: string;
  let askOrBid: "ask" | "bid";
  let [buy, sell] = [transition.buy.asset.symbol, transition.sell.asset.symbol];

  // TODO: make sure bitfinex is usdt
  if (buy === "USD" && transition.marketPair.exchange === "Bitfinex") { buy = "USDT"; }
  if (sell === "USD" && transition.marketPair.exchange === "Bitfinex") { sell = "USDT"; }

  log.info("get market pair symbol");
  if (exchangeModule.symbols.includes(buy + "/" + sell)) {
    pair = buy + "/" + sell;
    // ccxt keeps quote currency on the right side of a market pair symbol
    // so if we are selling base/buying market we will have to look at the asks
    askOrBid = "ask";
  } else if (exchangeModule.symbols.includes(sell + "/" + buy)) {
    // if selling market/buying base look at bids
    pair = sell + "/" + buy;
    askOrBid = "bid";
  } else {
    throw new Error(`failed to find a market pair for buy/sell ${buy}/${sell}`);
  }
  return [pair, askOrBid];
}

export async function getOrderbookForTransition(transition: ITransition): Promise < [IOrderBook, "ask" | "bid"] > {
  const exchangeModule = await getExchangeModuleForTransition(transition);
  const [marketPairSymbol, askOrBid] = getMarketPairSymbolForTransition(transition, exchangeModule);
  const orderbook = await exchangeModule.fetchOrderBook(marketPairSymbol);
  return [orderbook, askOrBid];
}
