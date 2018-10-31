import Server from "./Server";

async function main() {
  const server = new Server();

  await server.listen(4000);
}

main();
