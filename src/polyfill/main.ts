
// Async Iterator support 
require('source-map-support').install({ hookRequire: true });
require("../bluebird-stacktraces")


export * from './lib/exception'
export * from './lib/outstanding-task-awaiter'
export * from "./lib/lazy-promise"
export * from "./lib/lazy"

/** 
 * Creates a shallow copy of a given object by copying the properties to a new object
 * Note: this does not copy the method prototypes, so it's a shallow data copy only.
 * 
 * @param {input} any javascript object 
 * @param {filter} Array<string> of properties to filter out from the copy.
 */
export function shallowCopy(input: any, ...filter: Array<string>): any {
  if (!input) {
    return input;
  }
  const keys = input.Keys ? input.Keys : Object.getOwnPropertyNames(input);

  const result: any = {};
  for (const key of keys) {
    if (filter.indexOf(key) == -1) {
      const value = input[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function Delay(delayMS: number): Promise<void> {
  return new Promise<void>(res => setTimeout(res, delayMS));
}

export class ManualPromise<T> implements Promise<T> {
  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2> {
    return this.p.then(onfulfilled);
  }
  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult> {
    return this.p.catch(onrejected);
  }
  readonly [Symbol.toStringTag]: "Promise";

  public fn_resolve: (value?: T | PromiseLike<T> | undefined) => void = (v) => { };
  public fn_reject: (e: any) => void = (e) => { };
  private p: Promise<T>;
  public constructor() {
    this.p = new Promise<T>((r, j) => { this.fn_resolve = r; this.fn_reject = j });
  }
}

export class CriticalSection {
  private promise: ManualPromise<void> | undefined;

  public async enter(): Promise<void> {
    while (this.promise) {
      await Delay(10);
      // wait for its release
      await this.promise;

      // make sure it's still not busy
      if (this.promise) {
        continue;
      }
    }
    this.promise = new ManualPromise<void>();
  }

  public async exit(): Promise<void> {
    const p = this.promise;
    this.promise = undefined
    if (p) {
      p.fn_resolve();
    }
  }
}
