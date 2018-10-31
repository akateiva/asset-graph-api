import mongodb from "mongodb";
import config from "./config";

const client: mongodb.MongoClient = new mongodb.MongoClient(config.get("MONGO_URL"), {useNewUrlParser: true});

export default client;
