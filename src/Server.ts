import express from "express";
import { ChangeStream, MongoClient } from "mongodb";
import pino from "pino";
import * as AssetGraphController from "./controllers/AssetGraph.controller";
import * as AssetGraphModel from "./models/AssetGraph";
import config from "./util/config";

export default class Server {
  public app: express.Application;
  public log: pino.Logger;
  public mongoClient: MongoClient | null = null;
  private changeStream: ChangeStream | null = null;

  constructor() {
    this.app = express();
    this.log = pino();
    this.setupRoutes();
  }

  public async listen(port: number) {
    this.mongoClient = await MongoClient.connect(config.get("MONGO_URL"), {useNewUrlParser: true});
    this.changeStream = await AssetGraphModel.attachToMongo(this.mongoClient);
    const http = await this.app.listen(port);
    return http;
  }

  public async shutdown() {
    if (this.changeStream) { await this.changeStream!.close(); }
    if (this.mongoClient) { await this.mongoClient.close(); }
  }

  private setupRoutes() {
    this.app.get("/cycles/search/:baseAsset", AssetGraphController.findCycles);
    this.app.get("/cycles/:cycleId", AssetGraphController.getCycle);
  }
}
