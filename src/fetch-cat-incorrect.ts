import fetch from "node-fetch";

import { pipeline } from "node:stream/promises";

import { subscribe } from "./event-subscription.js";
import { openFile } from "./file.js";
import { Mutex } from "./mutex.js";
import { TaskQueue } from "./task-queue.js";

export async function fetchCat(
  options: {
    urls: string[],
    outPath: string,
    concurrency: number,
    onError: (error: any) => void,
  },
): Promise<void> {
  const { urls, outPath, concurrency, onError } = options;

  await using taskQueue = new TaskQueue({ concurrency });
  using errorSubscription = subscribe(taskQueue, "error", onError);

  const outFileMutex = new Mutex();
  await using outFile = await openFile(outPath, "w");

  for (const url of urls) {
    taskQueue.push(async () => {
      const response = await fetch(url);

      {
        using outFileGuard = await outFileMutex.acquire();

        await pipeline(
          response.body!,
          outFile.createWriteStream({ autoClose: false }),
        );
      }
    });
  }
}
