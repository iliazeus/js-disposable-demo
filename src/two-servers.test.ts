import "disposablestack/auto";
import "cross-fetch/polyfill";
import "source-map-support/register";

import assert from "node:assert/strict";
import { once } from "node:events";
import { describe, it } from "node:test";

import express from "express";

async function createServer(port: number, text: string): Promise<AsyncDisposable> {
  const app = express().use(express.json());
  app.get("/", (req, res) => res.send({ text }));

  const server = app.listen(port);
  await once(server, "listening");

  return {
    [Symbol.asyncDispose]: () => new Promise((rs, rj) => {
      server.close((err) => err ? rj(err) : rs());
    }),
  };
}

async function createTwoServers(port1: number, text1: string, port2: number, text2: string): Promise<AsyncDisposable> {
  await using stack = new AsyncDisposableStack();

  stack.use(await createServer(port1, text1));
  stack.use(await createServer(port2, text2));

  return stack.move();
}

describe("two-servers", () => {
  it("works in simple case", async () => {
    await assert.rejects(() => fetch("http://localhost:3000"));
    await assert.rejects(() => fetch("http://localhost:3001"));

    {
      await using handle = await createTwoServers(3000, "foo", 3001, "bar");

      assert.deepEqual(
        await (await fetch("http://localhost:3000")).json(),
        { text: "foo" },
      );

      assert.deepEqual(
        await (await fetch("http://localhost:3001")).json(),
        { text: "bar" },
      );
    }

    await assert.rejects(() => fetch("http://localhost:3000"));
    await assert.rejects(() => fetch("http://localhost:3001"));
  });

  it("throws on first error", async () => {
    await assert.rejects(async () => {
      await using handle = await createTwoServers(-3000, "foo", 3001, "bar");
    });

    await assert.rejects(() => fetch("http://localhost:3000"));
    await assert.rejects(() => fetch("http://localhost:3001"));
  });

  it("throws on second error", async () => {
    await assert.rejects(async () => {
      await using handle = await createTwoServers(3000, "foo", -3001, "bar");
    });

    await assert.rejects(() => fetch("http://localhost:3000"));
    await assert.rejects(() => fetch("http://localhost:3001"));
  });
})