/*
import {MongoClient} from "mongodb";
import request = require("supertest");
import Server from "../Server";
import config from "../util/config";

const app = new Server();
let httpServer: any;

beforeAll(async () => {
  httpServer = await app.listen(0);
});

afterAll(async () => {
  await httpServer.close();
  await app.shutdown();
});

test("/arbitrage/triangles", async () => {
  const resp = await request(app.app).get("/arbitrage/triangles/USD");
  expect(resp.status).toBe(200);
  expect(resp.body).toBeInstanceOf(Object);
});
 */

import {computeTransitionRevenue} from "./AssetGraph.controller";

test("selling 1 BTC for 5400 USD", () => {
  // selling BTC buying USD with an BID order
  const orders = [ [5400, 2] ] as Array<[number, number]>;
  const result = computeTransitionRevenue(1, orders);
  expect(result).toBe(5400);
});

test("selling 2 BTC for 10800 USD", () => {
  // selling BTC buying USD with an BID order
  const orders = [ [5400, 2] ] as Array<[number, number]>;
  const result = computeTransitionRevenue(2, orders);
  expect(result).toBe(10800);
});

test("selling 3 BTC on an insufficient orderbook should return null", () => {
  const orders = [ [5400, 2] ] as Array<[number, number]>;
  const result = computeTransitionRevenue(3, orders);
  expect(result).toBe(NaN);
});

test("selling 5400 USD for 1 BTC with ask order", () => {
  // ASK orderbook format
  const orders = [ [1 / 5400, 2 * 5400] ] as Array<[number, number]>;
  const result = computeTransitionRevenue(5400, orders);
  expect(result).toBe(1);
});
