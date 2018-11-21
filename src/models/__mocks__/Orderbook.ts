import { Transition } from "../AssetGraph";
import ORDERBOOK_FIXTURES from "../../__tests__/__fixtures__/Orderbooks";

const mockGetOrderbookForTransition = jest.fn((t: Transition) => {
  const fixtureKey = `${t.marketPair.base.symbol}${t.marketPair.market.symbol}`;
  // @ts-ignore
  return Promise.resolve([ ORDERBOOK_FIXTURES[fixtureKey], "asks"]);
});

export {mockGetOrderbookForTransition as getOrderbookForTransition};
