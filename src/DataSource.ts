import mongo from "mongodb";
import {IMarketTicker} from "./models/AssetGraph";
import config from "./util/config";

const FIVE_MINUTES = 5 * 60 * 1000;

export default class DataSource {

  private client: mongo.MongoClient;

  constructor() {
    this.client = new mongo.MongoClient(config.get("MONGO_URL"), {
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
      $sort: {WriteDate: 1},
    },{
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
    //fs.writeFileSync("./market-states.json", JSON.stringify(result))
    return result;
  }

  public subscribeToNewTickers(tickerHandler: ( ticker: IMarketTicker ) => void){
    this.client.db('xlab-prices').collection('prices').watch([{$match : {"operationType" : "insert" }}])
      .on("change", (change) => {
        tickerHandler(change.fullDocument);
      });
  }
}

//db.prices.createIndex({BaseCurrency:1, MarketCurrency: 1, WriteDate: 1, Exchange: 1}, { unique: true })
