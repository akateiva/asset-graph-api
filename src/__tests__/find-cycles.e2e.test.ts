import Server from "../Server";
import request from "supertest";
import TICKER_TEST_FIXTURE from "./__fixtures__/EUR-LTL-USD-tickers";
import MongoMemoryServer from "mongodb-memory-server";
import {MongoClient} from "mongodb";
jest.mock('../models/Orderbook');

let server: Server;
let httpServer: any;
const mongod = new MongoMemoryServer({instance: {dbName: "xlab-prices"}});

async function insertFixtureIntoDatabase(connectionString: string): Promise<void> {
  const client = new MongoClient(connectionString, {useNewUrlParser: false});
  await client.connect();
  await client.db("xlab-prices").collection("prices").insertMany(TICKER_TEST_FIXTURE.prices);
}

async function setupServer(): Promise<Server> {
  try {
    const mongoUrl = await mongod.getConnectionString();
    await insertFixtureIntoDatabase(mongoUrl);
    server = new Server({MONGO_URL: mongoUrl, useChangeStream: false});
    httpServer = await server.listen(0);
    return server;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

async function teardownServer(): Promise<void> {
  try {
    await mongod.stop();
    await httpServer.close();
  } catch (e) {
    console.error(e);
  }
}

function parseStreamedSearchResults(body: string) {
  const cycleArray: any[] = [];
  body.split(/[\r?\n]+/).forEach((line) => {
    if (line.startsWith("data: {")) {
      cycleArray.push(JSON.parse(line.slice(6)));
    }
  });
  return cycleArray;
}

beforeAll(setupServer, 10 * 1000);
afterAll(teardownServer, 10 * 1000);

describe("POST /cycles/search", () => {
  it("returns correct arbitrage cycle for EUR-LTL-USD-EUR fixture", async () => {
    const result = await request(httpServer).post("/cycles/search")
      .send({
        baseAssetSymbol: "EUR",
      });
    expect(result.status).toBe(200);
    const cycles = parseStreamedSearchResults(result.text);
    expect(cycles[0].id).toBe("EUR,Exchange 1,LTL,Exchange 2,USD,Exchange 3");
    expect(cycles[0].maxRate).toBeCloseTo(1.1598);
    expect(cycles[0].trades[0]).toEqual(expect.objectContaining({
      sell: "EUR",
      buy: "LTL",
      exchange: "Exchange 1",
    }));
    expect(cycles[0].trades[0].unitLastPrice).toBeCloseTo(3.225806451, 8); // Checks up to the eighth digit
    expect(cycles[0].trades[1]).toEqual(expect.objectContaining({
      sell: "LTL",
      buy: "USD",
      exchange: "Exchange 2",
      relativeVolume : 4843.75, // EUR
    }));
    expect(cycles[0].trades[2]).toEqual(expect.objectContaining({
      sell: "USD",
      buy: "EUR",
      exchange: "Exchange 3",
      relativeVolume : 48.43749999999999, // EUR
    }));
    expect(cycles[0].trades[2].unitLastPrice).toBeCloseTo(1.123595505, 8); // Checks up to the eighth digit
  });

  /*
  it("finds no cycles from EUR with minimum volume of 10k EUR", async () => {
    const result = await request(httpServer).post("/cycles/search")
      .send({
        baseAssetSymbol: "EUR",
        minimumVolume: 10000,
      });
    expect(result.status).toBe(200);
    expect(result.body.timeExhausted).toBe(false);
    expect(result.body.took).toBeGreaterThanOrEqual(0);
    expect(cycles).toHaveLength(0);
  });
   */

  it("finds no cycles from EUR on Exchange 1 and 2 exclusively", async () => {
    const result = await request(httpServer).post("/cycles/search")
      .send({
        baseAssetSymbol: "EUR",
        exchanges: ["Exchange 1", "Exchange 2"],
      });
    expect(result.status).toBe(200);
    const cycles = parseStreamedSearchResults(result.text);
    expect(cycles).toHaveLength(0); });
});

describe("GET /symbols", () => {
  it("returns the symbols from the fixture", async () => {
    const result = await request(httpServer).get("/symbols");
    expect(result.status).toBe(200);
    const symbolsInFixture = ["USD", "LTL", "EUR", "JPY"];
    expect(result.body.availableSymbols).toEqual(expect.arrayContaining(symbolsInFixture));
  });
});
