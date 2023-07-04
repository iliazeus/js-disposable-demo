import { program } from "commander";

// import { fetchCat } from "./fetch-cat-incorrect.js";
import { fetchCat } from "./fetch-cat.js";

program.name("fetch-cat");
program.description("Fetch several remote resources, concatenate them, then write to a file");

program
  .arguments('<urls...>')
  .requiredOption('-o --outPath <path>')
  .option('-j --concurrency <number>', '', Number, 2)
  .action(async (urls: string[], options: { outPath: string, concurrency: number }) => {
    await fetchCat({ urls, ...options, onError: (err) => console.error(explain(err)) });
  });

const explain = (error: Error) => {
  let message = error.message;

  for (let e = error.cause as Error; e; e = e.cause as Error) {
    message += ': ' + e.message;
  }

  return message;
}

await program.parseAsync();
