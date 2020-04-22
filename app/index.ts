import clock from "clock";
import document from "document";
import { me } from "device";
import { memory } from "system";
import { HeartRateSensor } from "heart-rate";
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
        () => { hrs?.start(); },
        () => { hrs?.stop(); bpm = 0; },
    );

    // Listen for heart rate
    hrs.addEventListener('reading', () => { bpm = hrs?.heartRate || 0; });
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



// Allow having different states for the info box
let state: number = 0;
const nr_states = 2;
const sec_p_state = 2;

// TODO: use user-chosen locale?
const months: string[] = [
    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

const days: string[] = [
    // Sun..Sat because ISO-8601 is too hard
    "日・にち", "月・げつ", "火・か", "水・すい", "木・もく", "金・きん", "土・ど"
];


clock.ontick = wraperr(({ date }) => {

    // I have wrapped several blocks in a `runv` statement to make sure
    // that everything else can still render if something goes wrong

    // Set time
    runv((): void => {
        const secs = date.getSeconds();

        $('hour').text = date.getHours().toString();
        $('minute').text = util.leftpad(date.getMinutes().toString(), 2, '0');
        $('second').text = util.leftpad(secs.toString(), 2, '0');

        state = Math.floor((secs % (nr_states * sec_p_state)) / sec_p_state);
    });

    // Set date
    runv((): void => {
        $('weekday').text = days[date.getDay()];
        $('day').text = util.leftpad(date.getDate().toString(), 2, ' ');
        $('month').text = months[date.getMonth()];
        $('year').text = "'" + (date.getFullYear() % 100).toString(); // Y2K bug
    });

    // Set battery
    runv((): void => {
        const charge = Math.round(battery.chargeLevel);

        $('battery').text = charge.toString();

        $style('battery').fill = charge <= 25 ? 'red' : 'white';
    });

    // Set bpm, steps and floors
    runv((): void => {
        const steps = today.adjusted.steps;

        $('bpm').text = bpm ? bpm.toString() : '--';
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
        else if (state === 1) {
            $('info_left').text = "Memory";
            $('info_right').text = util.b2kb(memory.js.used) + "/" + util.b2kb(memory.js.total) + " KB";
        }
    });
});
