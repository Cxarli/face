import clock from "clock";
import document from "document";
import { me } from "device";
import { memory } from "system";
import { HeartRateSensor } from "heart-rate";
import { Barometer } from "barometer";
import { today } from "user-activity";
import { battery } from "power";
import { BodyPresenceSensor } from "body-presence";
import { display } from "display";

import * as util from "../common/utils";
import { runv, wraperr } from "../common/utils";

clock.granularity = "seconds";

// milliseconds
type ms = number;


const $ = (() => {
    /**
     * Add a wrapper around the normal Element to cache all .text calls
     * to make sure that nothing on the DOM happens if the value didn't change
     */
    class WrappedElement {
        private _element: Element;
        private _prev_text?: string;
        private _href?: string;

        constructor(element: Element) {
            this._element = element;
        }

        get element(): Element {
            return this._element;
        }

        get text(): string {
            if (typeof this._prev_text !== 'undefined') return this._prev_text;

            return this._prev_text = this._element.text;
        }

        set text(value: string) {
            // Don't change if nothing changed
            if (this._prev_text === value) return;

            this._prev_text = this._element.text = value;
        }

        get href(): string {
            if (typeof this._href !== 'undefined') return this._href;

            return this._href = (<ImageElement> this._element).href;
        }

        set href(value: string) {
            if (this._href === value) return;

            this._href = (<ImageElement> this._element).href = value;
        }
    }

    // Cache for $
    const cache: Record<string, WrappedElement> = {};

    /**
     * Helper to get an element by ID
     * This throws when the ID is not found
     */
    return function(id: string): WrappedElement {
        // Try cache
        if (typeof cache[id] !== 'undefined') return cache[id];

        // Retrieve
        const elem = document.getElementById(id);
        if (elem === null) {
            throw new TypeError("Unknown ID `" + id + "`");
        }

        // Store in cache
        return cache[id] = new WrappedElement(elem);
    };
})();


/**
 * Access the style of the element with the given ID
 * @param id
 */
const $style = (() => {
    class WrappedStyle {
        private _style: Style;

        constructor(style: Style) {
            this._style = style;
        }


        private _fontSize?: number;
        get fontSize(): number|undefined {
            if (typeof this._fontSize !== 'undefined') return this._fontSize;
            return this._fontSize = this._style.fontSize;
        }

        set fontSize(fontSize: number|undefined) {
            if (this._fontSize === fontSize) return;
            this._fontSize = this._style.fontSize = fontSize;
        }


        private _fill?: string;
        get fill(): string {
            if (typeof this._fill !== 'undefined') return this._fill;
            return this._fill = this._style.fill;
        }

        set fill(fill: string) {
            if (this._fill === fill) return;
            this._fill = this._style.fill = fill;
        }
    }

    return function(id: string): WrappedStyle {
        const el = $(id).element;

        if (typeof (<any>el).style === 'undefined') throw new TypeError("Not a graphicselement");

        return new WrappedStyle((el as GraphicsElement).style);
    };
})();

// --- Heart rate --- \\

// Read heart rate
let bpm = 0;

try {
    if (!HeartRateSensor) throw new Error("No heart rate sensor detected");

    const hrs: HeartRateSensor = new HeartRateSensor();

    enum reason {
        nobody = 1,
        nodisplay = 2,
    }

    // Allow pausing for several reasons
    let hrspauser: util.Pauser<reason> = new util.Pauser(
        () => { hrs.start(); },
        () => { hrs.stop(); bpm = 0; },
    );

    // Listen for heart rate
    hrs.addEventListener('reading', () => { bpm = hrs.heartRate || 0; });
    hrs.start();

    // Pause when not on body
    if (BodyPresenceSensor) {
        const bps = new BodyPresenceSensor();
        bps.addEventListener('reading', () => { hrspauser.apply(reason.nobody, !bps.present); });
        bps.start();
    }

    // Pause when not displayed
    display.addEventListener('change', () => { hrspauser.apply(reason.nodisplay, !display.on); });

} catch (e) { console.error(e); }


// -- Barometer -- \\

let hpa = 0;

try {
    if (!Barometer) throw new Error("no barometer available");
    const brm: Barometer = new Barometer({ frequency: 1 });

    enum reason {
        nobody = 1,
        nodisplay = 2,
    }

    // Allow pausing for several reasons
    let brmpauser: util.Pauser<reason> = new util.Pauser(
        () => { brm.start(); },
        () => { brm.stop(); bpm = 0; },
    );

    // Listen for changes
    brm.addEventListener("reading", () => { hpa = brm.pressure || 0;});
    brm.start();

    // Pause when not on body
    if (BodyPresenceSensor) {
        const bps = new BodyPresenceSensor();
        bps.addEventListener('reading', () => { brmpauser.apply(reason.nobody, !bps.present); });
        bps.start();
    }

    // Pause when not displayed
    display.addEventListener('change', () => { brmpauser.apply(reason.nodisplay, !display.on); });

} catch (e) { console.error(e); }



// Allow having different states for the info box
let state: number = 0;
const nr_states: number = 2;
const time_per_state: ms = 2000;

// TODO: use user-chosen locale?
const months: string[] = [
    // January, February, March, April, May, June, July, August,   September, October, November, December
    // Januari, Februari, Maart, April, Mei, June, Juli, Augustus, September, Oktober, November, December
    // January, Februari, Mars,  April, Maj, Juni, Juli, Augusti,  September, Oktober, November, December

    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

const days: [string, string, string][] = [
    // Sun..Sat because ISO-8601 is too hard

    // sun, mon,  tues, wednes, thurs,  fri,  satur
    // zon, maan, dins, woens,  donder, vrij, zater
    // sön, mån,  tis,  ons,    tors,   fre,  lör

    ["日", "にち", "so"],
    ["月", "げつ", "ma"],
    ["火", "か",   "ti"],
    ["水", "すい", "wo"],
    ["木", "もく", "to"],
    ["金", "きん", "fr"],
    ["土", "ど",   "za"],
];


clock.ontick = wraperr(({ date }) => {

    // I have wrapped several blocks in a `runv` statement to make sure
    // that everything else can still render if something goes wrong

    // Set time
    runv((): void => {
        const secs = date.getSeconds();
        const msecs: ms = secs * 1000;

        $('hour').text = date.getHours().toString();
        $('minute').text = util.leftpad(date.getMinutes().toString(), 2, '0');
        $('second').text = util.leftpad(secs.toString(), 2, '0');

        // Update time
        state = Math.floor((msecs % (nr_states * time_per_state)) / time_per_state);
    });

    // Set date
    runv((): void => {
        const day = days[date.getDay()];
        const kanji = day[0];
        const furigana = day[1];
        const weekday = day[2];

        $('weekday').text = kanji;
        $('day').text = util.leftpad(date.getDate().toString(), 2, ' ');
        $('month').text = months[date.getMonth()];

        // furigana, weekday, month, year
        const dst = (
          (date.getMonth() + 1).toString() + ' '
          + "'" + (date.getFullYear() % 100).toString()
        );
        const dsb = furigana + ' ' + weekday;
        $('datesubtop').text = dst;
        $('datesubbot').text = dsb;
    });

    // Set battery
    runv((): void => {
        const charging = battery.charging;
        const charge = Math.round(battery.chargeLevel);

        $('battery').text = charge.toString();

        // Make it filled when it's charging
        $('battery_image').href = 'assets/icons/stat_am_' + (charging ? 'solid' : 'open') + '_32px.png';

        // Make it red when it's almost empty
        $style('battery').fill = charge <= 25 ? 'red' : 'white';
    });

    // Set bpm, pressure, steps, and floors
    runv((): void => {
        const steps = today.adjusted.steps;

        $('bpm').text = bpm ? bpm.toString() : '--';
        $('hpa').text = hpa ? Math.floor(hpa - 100000).toString() : '--';
        $('steps').text = steps?.toString() || '--';
        $('floors').text = today.adjusted.elevationGain?.toString() || '--';

        $style('steps').fontSize = steps && steps >= 10000 ? 30 : 36;
    });

    // Set info
    runv((): void => {
        if (state === 0) {
            $('info_left').text = "Last sync";
            $('info_right').text = util.ago(me.lastSyncTime);
        }

        else if (state === 1 && battery.charging && battery.timeUntilFull) {
            $('info_left').text = "Charge ready";
            $('info_right').text = util.until(battery.timeUntilFull);
        }
    });
});
