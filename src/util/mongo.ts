import mongodb from "mongodb";

let MONGO_CLIENT: mongodb.MongoClient;

export async function connect() {
  MONGO_CLIENT = await mongodb.connect("mongodb://localhost:27017", {useNewUrlParser: true});
  return MONGO_CLIENT;
}

export function getClient(): mongodb.MongoClient {
  return MONGO_CLIENT;
}
