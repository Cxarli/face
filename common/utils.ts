export function noop(): void {}

export function plural(amount: number, singular: string, plural?: string): string {
	if (typeof plural === 'undefined') plural = singular + 's';

	return amount + ' ' + (amount === 1 ? singular : plural);
}

export function leftpad(str: string, len: number, ch: string = ' '): string {
	// kindly stolen from the one and only left-pad

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


export function ago(date: Date): string {
	let now = Date.now();

	let diff_s = Math.round((now - date.getTime()) / 1000);

	if (diff_s > 3600) {
		return plural(Math.floor(diff_s / 3600), 'hour') + ' ago';
	}

	else if (diff_s > 60) {
		return plural(Math.floor(diff_s / 60), 'minute') + ' ago';
	}

	else {
		return plural(diff_s, 'second') + ' ago';
	}
}
