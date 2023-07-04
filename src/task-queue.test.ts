import { TaskQueue } from "./task-queue.js";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

describe("task-queue", () => {
  it("is disposed at scope exit", async () => {
    let runningTaskCount = 0;
    let maxRunningTaskCount = 0;

    const task = async () => {
      runningTaskCount += 1;
      maxRunningTaskCount = Math.max(maxRunningTaskCount, runningTaskCount);

      await sleep(100);

      runningTaskCount -= 1;
    };

    {
      await using queue = new TaskQueue({ concurrency: 2 });

      queue.push(task);
      queue.push(task);
      queue.push(task);
      queue.push(task);
    }

    assert.equal(runningTaskCount, 0);
    assert.equal(maxRunningTaskCount, 2);
  });
});
