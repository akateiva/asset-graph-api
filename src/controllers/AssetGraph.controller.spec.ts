import Server from "../Server";
import {MongoClient} from "mongodb";
import request from "supertest";
import config from "../util/config";

test("/arbitrage/triangles", async () => {
  const app = await new Server().listen(0);
  const addr = app.address();
  const response = await request(app).get("arbitrage/triangles/USD");
  expect(response.status).toBe(200);
});
