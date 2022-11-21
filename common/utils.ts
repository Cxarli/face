/**
 * Utils
 */

/**
 * Get the singular or plural word depending on the number
 *
 * @param amount
 * @param singular
 * @param plural optional; is `singular + "s"` if left empty
 */
export function plural(amount: number, singular: string, plural?: string): string {
  if (typeof plural === 'undefined') plural = singular + 's';

  return amount + ' ' + (amount === 1 ? singular : plural);
}

/**
 * Kindly stolen from the one and only left-pad package
 *
 * @param str
 * @param len
 * @param ch
 */
export function leftpad(str: string, len: number, ch: string = ' '): string {
  len = len - str.length;
  if (len <= 0) return str;

  let pad = '';
  while (true) {
    if (len & 1) pad += ch;
    len >>= 1;
    if (len) ch += ch; else break;
  }

  return pad + str;
}

/**
 * Express the difference between now and the given date in a nice and human-like way
 *
 * @param date
 */
export function ago(date: Date): string {
  // Get difference in seconds
  let diff_s = Math.round((Date.now() - date.getTime()) / 1000);


  if (diff_s >= 3600) {
    return plural(Math.floor(diff_s / 3600), 'hour') + ' ago';
  }
  else if (diff_s >= 60) {
    return plural(Math.floor(diff_s / 60), 'min') + ' ago';
  }
  else if (diff_s >= 10) {
    return plural(diff_s, 'sec') + ' ago';
  }
  else if (diff_s >= -1) { // for some rounding issues (-0.1), we take 1 second in the future as "now"
    return "just now";
  }
  else {
    return "in the future";
  }
}

/**
 * Express the difference between now and the given date in a nice and human-like way
 *
 * @param date
 */
export function until(diff_s: number): string {
  if (diff_s >= 3600) {
    return 'in ' + plural(Math.floor(diff_s / 3600), 'hour');
  }
  else if (diff_s >= 60) {
    return 'in ' + plural(Math.floor(diff_s / 60), 'min');
  }
  else if (diff_s >= 10) {
    return 'in ' + plural(diff_s, 'sec');
  }
  else if (diff_s >= -1) { // for some rounding issues (-0.1), we take 1 second in the past as "now"
    return "soon";
  }
  else {
    return "already";
  }
}

type Fn<A extends any[], R> = (...args: A) => R;

// without default value: returns undefined on error, except when void
export function wraperr<A extends any[]>(fn: Fn<A, void>): Fn<A, void>;
export function wraperr<A extends any[], R>(fn: Fn<A, R>): Fn<A, R|undefined>;

// with default value: will always return given type
export function wraperr<A extends any[], R>(fn: Fn<A, R>, def: R): Fn<A, R>;

/**
 * Wrap function in a try-catch statement
 */
export function wraperr<A extends any[], R>(fn: Fn<A, R>, def?: R): Fn<A, R|undefined> {
  return (...args: A): R|undefined => {
    try {
      return fn(...args);
    }
    catch (e) {
      console.error(e);
      return def;
    }
  };
}


export function runv<A extends any[]>(fn: (..._: A) => void, ...args: A): void {
  return wraperr(fn)(...args);
}

export function run<A extends any[], R>(def: R, fn: Fn<A, R>, ...args: A): R {
  return wraperr(fn, def)(...args);
}

declare global {
  interface Function {
    _1: (_1: any) => any;
  }
}

// Function with at least 1 argument
type Fn_1<A, R> = (_1: A, ..._: any[]) => R;

// allow doing stuff like `[1,2,3].map(x.push._1)
Object.defineProperty(Function.prototype, "_1", {
  get<A, R> (this: Fn_1<A, R>) {
    return (_1: A): R => {
      return this(_1);
    };
  },
  enumerable: false,
  configurable: true,
});


/**
 * Round bytes to kilobytes with 1 digit precision
 * @param bytes
 */
export function b2kb(bytes: number): number {
  return Math.round(bytes / 1024 * 10) / 10;
}



type emp = () => any;
export class Pauser<T extends number> {

  private _start: emp;
  private _stop: emp;
  private _reason: number;

  constructor(start: emp, stop: emp) {
    this._start = start;
    this._stop = stop;
    this._reason = 0;
  }

  pause(reason: T): void {
    if (this._reason === 0) this._stop();
    this._reason |= reason;
  }

  unpause(reason: T): void {
    this._reason &= ~reason;
    if (this._reason === 0) this._start();
  }

  apply(reason: T, cond: boolean): void {
    if (cond) this.pause(reason);
    else this.unpause(reason);
  }
}
