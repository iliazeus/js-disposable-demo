import "disposablestack/auto";
import "source-map-support/register";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fs from "node:fs/promises";

async function openFile(
  path: string,
  flags?: string | number,
): Promise<AsyncDisposable & fs.FileHandle> {
  const file = await fs.open(path, flags);

  return Object.assign(file, {
    [Symbol.asyncDispose]: () => file.close(),
  });
}

describe("file", () => {
  it("is disposed at scope exit", async () => {
    {
      await using file = await openFile("dist/test.txt", "w");
      await file.writeFile("test", "utf-8");
    }

    {
      await using file = await openFile("dist/test.txt", "r");
      assert.equal(await file.readFile("utf-8"), "test");
    }
  });
});
