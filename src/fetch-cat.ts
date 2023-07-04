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

  const errorSubscription = subscribe(taskQueue, "error", onError);
  taskQueue.resources.use(errorSubscription);

  const outFile = await openFile(outPath, "w");
  taskQueue.resources.use(outFile);

  const outFileMutex = new Mutex();

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
