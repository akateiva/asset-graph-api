import pino from "pino";
import config from "./config";

const logger = pino({
  name: "asset-graph-api",
  level: config.get("LOGGING_LEVEL"),
});

export default logger;
