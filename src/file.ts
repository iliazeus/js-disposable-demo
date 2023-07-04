import "disposablestack/auto";
import * as fs from "node:fs/promises";

export async function openFile(
  path: string,
  flags?: string | number,
): Promise<AsyncDisposable & fs.FileHandle> {
  const file = await fs.open(path, flags);

  return Object.assign(file, {
    [Symbol.asyncDispose]: () => file.close(),
  });
}
