import "disposablestack/auto";
import { EventEmitter, once } from "node:events";

export type Task = () => Promise<void>;

export class TaskQueue extends EventEmitter {
  readonly resources = new AsyncDisposableStack();

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
      await once(this, "taskFinished").catch(() => { });
    }

    await this.resources.disposeAsync();
  }
}
