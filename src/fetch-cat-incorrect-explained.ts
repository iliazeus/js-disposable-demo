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

  // обратите внимание на порядок инициализации ресурсов
  await using taskQueue = new TaskQueue({ concurrency });
  using errorSubscription = subscribe(taskQueue, "error", onError);
  await using outFile = await openFile(outPath, "w");

  const outFileMutex = new Mutex();

  for (const url of urls) {
    taskQueue.push(async () => {
      const response = await fetch(url);

      {
        using outFileGuard = await outFileMutex.acquire();

        await response.body?.pipeTo(outFile.writableWebStream());
      }
    });
  }

  // Здесь кончается область видимости у outFile и у taskQueue.
  // Освобождение ресурсов происходит в обратном порядке.
  // Получается, что outFile будет закрыт раньше, чем taskQueue закончится!
}
