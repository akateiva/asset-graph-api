import express from "express";
import { ChangeStream, MongoClient } from "mongodb";
import pino from "pino";
import pinoHttp from "pino-http";
import * as AssetGraphController from "./controllers/AssetGraph.controller";
import * as AssetGraphModel from "./models/AssetGraph";
import config from "./util/config";
import bodyParser from "body-parser";

export default class Server {
  public app: express.Application;
  public log: pino.Logger;
  public mongoClient: MongoClient | null = null;
  private changeStream: ChangeStream | null = null;
  private useChangeStream: boolean;
  private mongoUrl: string;
  private httpServer: any;

  constructor(opts: {MONGO_URL?: string, useChangeStream?: boolean} = {}) {
    this.useChangeStream = opts.useChangeStream || false;
    this.mongoUrl = opts.MONGO_URL || config.get("MONGO_URL");
    this.app = express();
    this.log = pino();
    this.app.use(bodyParser.json());
    this.app.use(pinoHttp({logger: this.log}));
    this.setupRoutes();
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      req.log.error(err, "error processing a request");
      res.status(500).send("Something broke!");
    });
  }

  public async listen(port: number) {
    this.log.info("listen: connecting to mongodb");
    this.mongoClient = await MongoClient.connect(this.mongoUrl, {useNewUrlParser: true});
    this.log.info("listen: attaching asset graph model to mongodb, useChangeStream: %b", this.useChangeStream);
    this.changeStream = await AssetGraphModel.attachToMongo(this.mongoClient, this.useChangeStream);
    this.log.info("listen: starting http server on port %d", port);
    this.httpServer = await this.app.listen(port);
    this.log.info("listen: listening on %j", this.httpServer.address());
    return this.httpServer;
  }

  public async shutdown() {
    if (this.changeStream) { await this.changeStream!.close(); }
    if (this.mongoClient) { await this.mongoClient.close(); }
  }

  private setupRoutes() {
    this.app.post("/cycles/search", AssetGraphController.findCycles);
    this.app.get("/cycles/search", (req: express.Request, res: express.Response, next: express.NextFunction) => {
      Object.assign(req.body, JSON.parse(req.query.query));
      next();
    }, AssetGraphController.findCycles);
    this.app.get("/cycles/:cycleId", AssetGraphController.getCycle);
    this.app.get("/symbols", AssetGraphController.getAvailableAssetSymbols);
  }
}
