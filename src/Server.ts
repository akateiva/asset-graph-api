import express from "express";
import pino from "pino";

export default class Server {
  public app: express.Application;
  public log: pino.Logger;

  constructor() {
    this.app = express();
    this.log = pino();
  }

  public async listen(port: number) {
    await this.app.listen(port);
  }
}
