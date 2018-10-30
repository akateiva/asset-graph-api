import * as AssetGraphController from "./controllers/AssetGraph.controller";
import express from "express"
import pino from "pino";
import mongodb from "./util/mongo";

export default class Server {
  public app: express.Application;
  public log: pino.Logger;

  constructor() {
    this.app = express();
    this.log = pino();
    this.app.get("/arbitrage/triangles/:baseAsset", AssetGraphController.findArbitrageTriangles);
  }

  public async listen(port: number) {
    await mongodb.connect();
    return await this.app.listen(port);
  }
}
