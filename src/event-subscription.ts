import "disposablestack/auto";
import { EventEmitter } from "node:events";

export function subscribe(
  obj: EventEmitter,
  e: string,
  fn: (...args: any[]) => void,
): Disposable {
  obj.on(e, fn);
  return { [Symbol.dispose]: () => obj.off(e, fn) };
}
