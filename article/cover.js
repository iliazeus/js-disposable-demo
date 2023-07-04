async function main() {
  await using connection = await connect();
  await doStuff(connection);
  // connection is closed
}
