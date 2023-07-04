import { subscribe } from "./event-subscription.js";
import { openFile } from "./file.js";
import { Mutex } from "./mutex.js";
import { TaskQueue } from "./task-queue.js";

/**
 * Забрать GET-запросами данные со всех `urls` и склеить по порядку в файл `outPath`.
 * Порядок страниц в выходном файле не гарантируется.
 * 
 * @param options.concurrency максимальное количество одновременных запросов
 * @param options.onError вызывается в случае ошибки при получении одного из urls
 */
export async function fetchCat(
  options: {
    urls: string[],
    outPath: string,
    concurrency: number,
    onError: (error: any) => void,
  },
): Promise<void> {
  const { urls, outPath, concurrency, onError } = options;

  // для ограничения concurrency воспользуемся очередью задач
  await using taskQueue = new TaskQueue({ concurrency });

  // подписку на событие тоже используем как ресурс
  using errorSubscription = subscribe(taskQueue, "error", onError);

  // синхронизируем запись в выходной файл мьютексом
  const outFileMutex = new Mutex();

  // файл будет закрыт в конце области видимости
  await using outFile = await openFile(outPath, "w");

  for (const url of urls) {
    taskQueue.push(async () => {
      // глобальный fetch() - еще одно недавнее нововведение Node.js
      // по интерфейсу он совместим с браузерным
      const response = await fetch(url);

      {
        using outFileGuard = await outFileMutex.acquire();

        // а еще можно использовать те же интерфейсы стримов, что и в браузере
        await response.body?.pipeTo(outFile.writableWebStream());
      }
    });
  }
}
