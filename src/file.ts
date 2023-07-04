import "disposablestack/auto";
import * as fs from "node:fs/promises";
import { Writable } from "node:stream";

export interface DisposableFile extends fs.FileHandle, AsyncDisposable {
  writableWebStream(options?: fs.CreateWriteStreamOptions): WritableStream;
}

export async function openFile(
  path: string,
  flags?: string | number,
): Promise<DisposableFile> {
  const file = await fs.open(path, flags);

  return Object.assign(file, {
    [Symbol.asyncDispose]: () => file.close(),

    writableWebStream: (
      options: fs.CreateWriteStreamOptions = { autoClose: false }
    ) => Writable.toWeb(file.createWriteStream(options)),
  });
}
