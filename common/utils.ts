/**
 * Kindly stolen from the one and only left-pad package
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
 * Express the difference between now and the given date (before now) in a nice and human-like way
 */
export function ago(date: Date): string {
  // Get difference in seconds
  let diff_s = Math.round((Date.now() - date.getTime()) / 1000);


  if (diff_s >= 3600) {
    return Math.floor(diff_s / 3600).toString() + 'h';
  }
  else if (diff_s >= 60) {
    return Math.floor(diff_s / 60).toString() + 'm';
  }
  else if (diff_s >= 10) {
    return diff_s.toString() + 's';
  }
  else if (diff_s >= -1) { // for some rounding issues (-0.1), we take 1 second in the future as "now"
    return "now";
  }
  else {
    // date in the future, shouldn't happen
    return ">>>";
  }
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
    this.apply(reason, true);
  }

  unpause(reason: T): void {
    this.apply(reason, false);
  }

  apply(reason: T, cond: boolean): void {
    if (cond) {
      if (this._reason === 0) this._stop();
      this._reason |= reason;
    } else {
      this._reason &= ~reason;
      if (this._reason === 0) this._start();
    }
  }
}
