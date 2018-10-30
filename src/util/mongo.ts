import mongodb from "mongodb";
import config from "./config";

export const client: mongodb.MongoClient = new mongodb.MongoClient(config.get('MONGO_URL'), {useNewUrlParser: true})

export const connect: () => Promise<mongodb.MongoClient> = client.connect;
