import "disposablestack/auto";

export class Mutex {
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
