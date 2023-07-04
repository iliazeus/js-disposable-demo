import "disposablestack/auto";
import * as fs from "node:fs/promises";
import { Writable } from "node:stream";

// тип нашего ресурса — объединение AsyncDisposable и исходного fs.FileHandle
export interface DisposableFile extends fs.FileHandle, AsyncDisposable {
  // добавим также вспомогательную функцию, которая понадобится нам позже
  writableWebStream(options?: fs.CreateWriteStreamOptions): WritableStream;
}

export async function openFile(
  path: string,
  flags?: string | number,
): Promise<DisposableFile> {
  const file = await fs.open(path, flags);

  // добавим функции прямо в объект file с помощью Object.assign
  return Object.assign(file, {
    [Symbol.asyncDispose]: () => file.close(),

    writableWebStream: (
      options: fs.CreateWriteStreamOptions = { autoClose: false }
    ) => Writable.toWeb(file.createWriteStream(options)),
  });
}
