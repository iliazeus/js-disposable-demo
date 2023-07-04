import "disposablestack/auto";
import "source-map-support/register";

import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

type Task = () => Promise<void>;

class TaskQueue extends EventEmitter {
  #concurrency: number;
  #tasks: Task[] = [];
  #runningTaskCount: number = 0;

  constructor(options: { concurrency: number }) {
    super();
    this.#concurrency = options.concurrency;
    this.on("taskFinished", () => this.#runNextTask());
  }

  push(task: Task): void {
    this.#tasks.push(task);
    this.#runNextTask();
  }

  #runNextTask(): void {
    if (this.#runningTaskCount >= this.#concurrency) return;

    const nextTask = this.#tasks.shift()!;
    if (!nextTask) return;

    this.#runningTaskCount += 1;

    nextTask()
      .catch((error) => {
        this.emit("error", error);
      }).finally(() => {
        this.#runningTaskCount -= 1;
        this.emit("taskFinished");
      });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    while (this.#tasks.length > 0 || this.#runningTaskCount > 0) {
      await once(this, "taskFinished");
    }
  }
}

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
