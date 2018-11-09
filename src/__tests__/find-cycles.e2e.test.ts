import Server from "../Server";
import request from "supertest";
import TICKER_TEST_FIXTURE from "./__fixtures__/EUR-LTL-USD-tickers";
import MongoMemoryServer from "mongodb-memory-server";
import {MongoClient} from "mongodb";

let server: Server;
let httpServer: any;
const mongod = new MongoMemoryServer({instance: {dbName: "xlab-prices"}});

async function insertFixtureIntoDatabase(connectionString: string): Promise<void> {
  console.log("starting to write fixtures");
  const client = new MongoClient(connectionString, {useNewUrlParser: false});
  await client.connect();
  await client.db("xlab-prices").collection("prices").insertMany(TICKER_TEST_FIXTURE.prices);
  console.log("fixtures inserted");
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

beforeAll(setupServer, 10 * 1000);
afterAll(teardownServer, 10 * 1000);

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
      relativeVolume : 50,
      //unitLastPriceDate: new Date(),
    }));
    expect(result.body.cycles[0].trades[0].unitLastPrice).toBeCloseTo(3.33333333, 8); // Checks up to the eighth digit
    expect(result.body.cycles[0].trades[1]).toEqual(expect.objectContaining({
      sell: "LTL",
      buy: "USD",
      exchange: "Exchange 2",
      relativeVolume : 50,
      unitLastPrice: 0.33,
      //unitLastPriceDate: new Date(),
    }));
    expect(result.body.cycles[0].trades[2]).toEqual(expect.objectContaining({
      sell: "USD",
      buy: "EUR",
      exchange: "Exchange 3",
      relativeVolume : 50,
      //unitLastPriceDate: new Date(),
    }));
    expect(result.body.cycles[0].trades[2].unitLastPrice).toBeCloseTo(1.136363636, 8); // Checks up to the eighth digit
  });
});
