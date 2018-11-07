import * as mongoUnit from "mongo-unit";
import Server from "../Server";
import request from "supertest";
import TICKER_TEST_FIXTURE from "./__fixtures__/EUR-LTL-USD-tickers";

let server: Server;
let httpServer: any;

async function setupServer(): Promise<Server> {
  const mongoUrl = await mongoUnit.start({dbName: "xlab-prices"});
  await mongoUnit.load(TICKER_TEST_FIXTURE);
  server = new Server({MONGO_URL: mongoUrl, useChangeStream: false});
  httpServer = await server.listen(0);
  return server;
}

beforeAll(setupServer, 30 * 1000);
afterAll(() => mongoUnit.stop().then(httpServer.close()));

describe("GET /cycles/search", () => {
  it("returns correct arbitrage cycle for EUR-LTL-USD-EUR fixture", async () => {
    const result = await request(httpServer).get("/cycles/search/EUR");
    expect(result.status).toBe(200);
    expect(result.body.timeExhausted).toBe(false);
    expect(result.body.took).toBeGreaterThan(0);
    expect(result.body.cycles[0].id).toBe("EUR,Exchange 1,LTL,Exchange 2,USD,Exchange 3");
    expect(result.body.cycles[0].maxRate).toBeCloseTo(1.25);
    expect(result.body.cycles[0].trades[0]).toEqual(expect.objectContaining({
      sell: "EUR",
      buy: "LTL",
      exchange: "Exchange 1",
    }));
    expect(result.body.cycles[0].trades[1]).toEqual(expect.objectContaining({
      sell: "LTL",
      buy: "USD",
      exchange: "Exchange 2",
    }));
    expect(result.body.cycles[0].trades[2]).toEqual(expect.objectContaining({
      sell: "USD",
      buy: "EUR",
      exchange: "Exchange 3",
    }));
  });
});
