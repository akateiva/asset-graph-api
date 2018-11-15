import Server from "../Server";
import * as agc from "./AssetGraph.controller";
import request from "supertest";

const server = new Server({useChangeStream: false});
server.app.post("/old", agc.findCyclesOld);

const SAMPLES = 10;

server.listen(0).then(async (httpServer) => {
  console.log("SERVER READY, STARTING BENCHMARK OF OLD SEARCH");
  let start = new Date();
  for (let i = 0; i < SAMPLES; i++) {
    await request(httpServer).post('/old').send({baseAssetSymbol: "USDT"});
  }
  let end = new Date();
  let took = end.getTime() - start.getTime();
  console.log("OLD DONE, TOOK: ", took, "MS")

  console.log("NOW BENCHMARKING NEW SEARCH");
  start = new Date();
  for (let i = 0; i < SAMPLES; i++) {
    await request(httpServer).post('/cycles/search').send({baseAssetSymbol: "USDT"});
  }
  end = new Date();
  took = end.getTime() - start.getTime();
  console.log("NEW DONE, TOOK: ", took, "MS")
});
