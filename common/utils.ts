
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
