import "disposablestack/auto";
import "source-map-support/register";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const openHandles = new Set<number>();

function openHandle(): number {
  const handle = Math.random();
  openHandles.add(handle);
  return handle;
}

function closeHandle(handle: number): void {
  if (!openHandles.has(handle)) throw new Error("invalid handle");
  openHandles.delete(handle);
}

class SimpleResource {
  #handle: number;

  constructor() {
    this.#handle = openHandle();
  }

  #isDisposed = false;

  dispose(): void {
    if (this.#isDisposed) return;
    this.#isDisposed = true;

    closeHandle(this.#handle);
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  get handle(): number {
    if (this.#isDisposed) throw new Error("object is disposed");
    return this.#handle;
  }
}

describe("SimpleResource", () => {
  it("works with using", () => {
    assert.equal(openHandles.size, 0);

    {
      using resource = new SimpleResource();
      assert.doesNotThrow(() => resource.handle);
    }

    assert.equal(openHandles.size, 0);
  });
});
