import express from "express";
import { MongoClient } from "mongodb";
import pino from "pino";
import * as AssetGraphController from "./controllers/AssetGraph.controller";
import * as AssetGraphModel from "./models/AssetGraph";
import config from "./util/config";

export default class Server {
  public app: express.Application;
  public log: pino.Logger;
  public mongoClient: MongoClient | null = null;

  constructor() {
    this.app = express();
    this.log = pino();
    this.app.get("/arbitrage/triangles/:baseAsset", AssetGraphController.findArbitrageTriangles);
  }

  public async listen(port: number) {
    this.mongoClient = await MongoClient.connect(config.get("MONGO_URL"), {useNewUrlParser: true});
    AssetGraphModel.attachToMongo(this.mongoClient);
    return await this.app.listen(port);
  }
}
