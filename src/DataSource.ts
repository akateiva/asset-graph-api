import mongo from "mongodb";
import {IMarketTicker} from "./models/AssetGraph";
import fs from "fs";

const FIVE_MINUTES = 5 * 60 * 1000;


export default class DataSource {

  private client: mongo.MongoClient;

  constructor(mongoUrl: string) {
    this.client = new mongo.MongoClient(mongoUrl, {
      useNewUrlParser: true
    });
    
  }

  public connect(): Promise<mongo.MongoClient> {
    return this.client.connect();
  }

  async getLatestMarketTickers(nMarkets = 5000): Promise < IMarketTicker[] > {
    const collection = this.client.db("xlab-prices").collection("prices");
    const fiveMinutesAgo = new Date(new Date().getTime() - FIVE_MINUTES);
    const result = await collection.aggregate([{
      // Limit this query to prices from the last 5 minutes
      $match: {
        WriteDate: {
          $gt: fiveMinutesAgo,
        },
      },
    }, {
      // Group by name and exchange. Place latest ticker in field ticker
      $group: {
        _id: {
          Name: "$Name",
          Exchange: "$Exchange",
        },
        ticker: {
          $last: "$$ROOT",
        },
      },
    }, {
      // Replace each aggregate result with latest ticker
      $replaceRoot: {
        newRoot: "$ticker",
      },
    }, {
      $sort: {
        BaseVolume: -1,
      },
    }]).limit(nMarkets).toArray() as IMarketTicker[];
    console.log(result.length);
    fs.writeFileSync("./market-states.json", JSON.stringify(result))
    return result;
  }
}


