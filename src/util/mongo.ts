import mongodb from "mongodb";
import config from "./config";

let MONGO_CLIENT: mongodb.MongoClient;

export async function connect() {
  MONGO_CLIENT = await mongodb.connect(config.get('MONGO_URL'), {useNewUrlParser: true});
  return MONGO_CLIENT;
}

export function getClient(): mongodb.MongoClient {
  return MONGO_CLIENT;
}
