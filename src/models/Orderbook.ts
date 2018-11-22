import ccxt from "ccxt";
import Logger from "../util/logger";
import {
  ITransition,
} from "./AssetGraph";
import Bottleneck from "bottleneck";
import NodeCache from "node-cache";

const log = Logger.child({
  name: "Orderbook",
});

class ExchangeModule {
  private ccxtModule: ccxt.Exchange;
  private rateLimiter = new Bottleneck({minTime: 200, maxConcurrent:  3});
  private orderbookCache = new NodeCache({stdTTL: 30, checkperiod: 15});

  constructor(private exchangeName: string) {
    // @ts-ignore
    this.ccxtModule = new ccxt[exchangeName]() as ccxt.Exchange;
  }

  get symbols() {
    return this.ccxtModule.symbols;
  }

  public async init(): Promise < ExchangeModule > {
    await this.ccxtModule.loadMarkets();
    return this;
  }

  public async fetchOrderBook(marketSymbol: string): Promise <IOrderBook> {
    let orderbook = this.orderbookCache.get<IOrderBook|Promise<IOrderBook>>(marketSymbol);
    if (orderbook === undefined) {
      log.debug("cache miss %s %s", this.exchangeName, marketSymbol);
      orderbook = this.rateLimiter.schedule<IOrderBook>(() => {
        return this.ccxtModule.fetchOrderBook(marketSymbol).then((result) => {
          this.orderbookCache.set<IOrderBook>(marketSymbol, result);
          return result;
        });
      });
      this.orderbookCache.set<IOrderBook|Promise<IOrderBook>>(marketSymbol, orderbook);
    }
    return orderbook;
  }
}

export interface IOrderBook {
  bids: Array < [number, number] > ; // bid array sorted in ascending price [price,amount]
  asks: Array < [number, number] > ; // ask array sorted in descending price [price, amount]
}

const exchangeModuleMap = new Map < string,
  ExchangeModule | Promise < ExchangeModule > > ();

async function getExchangeModuleForTransition(transition: ITransition): Promise < ExchangeModule > {
  let exchangeName = transition.marketPair.exchange.toLowerCase();

  // TODO: fix inconsistent exchange identifiers
  if (exchangeName === "huobi") {
    exchangeName = "huobipro";
  }

  let exchangeModule = exchangeModuleMap.get(exchangeName);
  if (!exchangeModule) {
    try {
      log.debug("getExchangeModuleForTransition: constructing new ccxt exchange module for %s", exchangeName);
      exchangeModule = (async () => {
        // @ts-ignore
        const exchangeModule = new ExchangeModule(exchangeName);
        await exchangeModule.init();
        exchangeModuleMap.set(exchangeName, exchangeModule);
        return exchangeModule;
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
                                          exchangeModule: ExchangeModule): [string, "ask" | "bid"] {
  let pair: string;
  let askOrBid: "ask" | "bid";
  let [buy, sell] = [transition.buy.asset.symbol, transition.sell.asset.symbol];

  // TODO: make sure bitfinex is usdt
  if (buy === "USD" && transition.marketPair.exchange === "Bitfinex") {
    buy = "USDT";
  }
  if (sell === "USD" && transition.marketPair.exchange === "Bitfinex") {
    sell = "USDT";
  }

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
