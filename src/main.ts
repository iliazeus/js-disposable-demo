import { parseArgs } from "node:util";

// import { fetchCat } from "./fetch-cat-incorrect.js";
import { fetchCat } from "./fetch-cat.js";

const explain = (error: Error) => {
  let message = error.message;

  for (let e = error.cause as Error; e; e = e.cause as Error) {
    message += ': ' + e.message;
  }

  return message;
}

const args = parseArgs({
  strict: true,
  allowPositionals: true,
  options: {
    outPath: {
      short: 'o',
      type: 'string',
    },
    concurrency: {
      short: 'j',
      type: 'string',
      default: '2',
    },
  },
});

if (!args.values.outPath) {
  console.log('missing required option: -o (--outPath)');
  process.exit(1);
}

await fetchCat({
  urls: args.positionals,
  outPath: args.values.outPath,
  concurrency: Number(args.values.concurrency),
  onError: (e) => {
    console.error(explain(e));
    process.exitCode = 1;
  },
});
