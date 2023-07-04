import { openFile } from "./file.js";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
