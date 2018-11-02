// .const nconf = require("nconf");
import nconf from "nconf";
// use env variables
nconf.env();

nconf.defaults({
  LOGGING_LEVEL: "debug",
  MONGO_URL: "mongodb://localhost:27017",
});

export default nconf;
