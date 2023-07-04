import "disposablestack/auto";
import "source-map-support/register";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

class Mutex {
  #promise: Promise<void> | null = null;

  async acquire(): Promise<Disposable> {
    while (this.#promise) await this.#promise;

    let callback: () => void;
    this.#promise = new Promise((cb) => callback = cb);

    return {
      [Symbol.dispose]: () => {
        this.#promise = null;
        callback!();
      }
    };
  }
}

describe("mutex-guard", () => {
  it("is disposed at scope exit", async () => {
    const mutex = new Mutex();
    let value: number = 0;

    const task = async () => {
      for (let i = 0; i < 5; i++) {
        using guard = await mutex.acquire();

        const newValue = value + 1;
        await sleep(100);
        value = newValue;
      }
    };

    await Promise.all([task(), task()]);

    assert.equal(value, 10);
  });
});
