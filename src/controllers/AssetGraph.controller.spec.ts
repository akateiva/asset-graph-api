import request from "supertest";
import config from "../util/config";
import {MongoClient} from "mongodb";
import Server from "../Server";

jest.mock("../util/mongo", async () => {
  
  return new MongoClient("");
});

// const app = new Server().app.listen(6464);
var app: any;

beforeAll(async () => {
  app = await (new Server().listen(0));
});

test("/arbitrage/triangles", async () => {
  const response = await request(app).get("arbitrage/triangles/USD");
  expect(response.status).toBe(200);
});
