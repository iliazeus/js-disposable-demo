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

  // Поле taskQueue.resources имеет тип AsyncDisposableStack.
  // Как часть контракта TaskQueue, оно освобождается в его dispose,
  // причем только после завершения всех задач.

  const errorSubscription = subscribe(taskQueue, "error", onError);
  taskQueue.resources.use(errorSubscription); // связываем время жизни

  const outFile = await openFile(outPath, "w");
  taskQueue.resources.use(outFile); // связываем время жизни

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

  // К этой области видимости из ресурсов привязан только сам taskQueue.
  // При его освобождении сначала будут выполнены все задачи в очереди,
  // а потом освобожден весь стек taskQueue.resources.
  // Таким образом, файл будет корректно закрыт
}
