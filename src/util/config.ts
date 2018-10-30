const nconf = require("nconf");
// use env variables
nconf.env();

nconf.defaults({
  MONGO_URL: "mongodb://localhost:27017",
  LOGGING_LEVEL: "trace",
});

export default nconf;
