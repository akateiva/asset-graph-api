import Server from "../Server";
import {MongoClient} from "mongodb";
import request = require("supertest");
import config from "../util/config";

const app = new Server();
var httpServer: any;

beforeAll(async () => {
  httpServer = await app.listen(0);
});

afterAll(async () => {
  await httpServer.close();
  await app.shutdown();
});

test("/arbitrage/triangles", async () => {
  const resp = await request(app.app).get('/arbitrage/triangles/USD')
  expect(resp.status).toBe(200);
  expect(resp.body).toBeInstanceOf(Object);
});
