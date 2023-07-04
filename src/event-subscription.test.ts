import { subscribe } from "./event-subscription.js";

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";


describe("event-subscription", () => {
  it("is disposed at scope exit", () => {
    const expectedEvents = [1, 2, 3];
    const actualEvents: number[] = [];

    const obj = new EventEmitter();
    const fn = (e: number) => actualEvents.push(e);

    {
      using guard = subscribe(obj, "event", fn);
      for (const e of expectedEvents) obj.emit("event", e);
    }

    obj.emit("event", 123);

    assert.deepEqual(actualEvents, expectedEvents);
    assert.equal(obj.listenerCount("event"), 0);
  });
});
