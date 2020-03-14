import clock from "clock";
import document from "document";
import { me } from "device";
import { memory } from "system";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { battery } from "power";
import * as util from "../common/utils";

clock.granularity = "seconds";


const $ = (() => {
    /**
     * Add a wrapper around the normal Element to cache all .text = calls
     * to make sure that nothing happens if the value didn't change
     */
    class WrappedElement {
        private _element: Element;
        private _prev_text?: string;

        constructor(element: Element) {
            this._element = element;
        }

        get text(): string {
            return this._element.text;
        }

        set text(value: string) {
            // Don't change if nothing changed
            if (this._prev_text === value) return;

            this._prev_text = this._element.text = value;
        }
    }

    // Cache for $
    const cache = {};

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

// Shortcut function
function err(e: Error): void {
    console.error(e);
}

// Read heart rate
let bpm: number = 0;
if (HeartRateSensor) {
    const hrm = new HeartRateSensor();

    hrm.addEventListener("reading", () => {
        if (hrm.heartRate !== null) {
            bpm = hrm.heartRate;
        }
    });

    hrm.start();
}


// Allow having different states
let state: number = 0;
const nr_states = 2;
const sec_p_state = 3;

// TODO: use user-chosen locale?
const months: string[] = [
    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

const days: string[] = [
    // Sun..Sat because ISO-8601 is too hard
    "日", "月", "火", "水", "木", "金", "土"
];


/**
 * Round bytes to kilobytes with 1 digit precision
 * @param bytes
 */
function b2kb(bytes: number): number {
    return Math.round(bytes / 1024 * 10) / 10;
}


clock.ontick = ({ date }) => {

    // I have wrapped several blocks in a try-catch statement to make sure
    // that everything else can still render if something goes wrong

    // Set time
    try {
        const hours = date.getHours();
        const mins = date.getMinutes();
        const secs = date.getSeconds();

        $('hour').text = hours.toString();
        $('minute').text = util.leftpad(mins.toString(), 2, '0');
        $('second').text = util.leftpad(secs.toString(), 2, '0');

        //                 (secs % (3         * 2          )) / 2
        //                 ([0..5]) / 2 -> [0;1, 2;3, 4;5]
        state = Math.floor((secs % (nr_states * sec_p_state)) / sec_p_state);

    } catch (e) { err(e); }

    // Set date
    try {
        const weekday = date.getDay();
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();

        $('weekday').text = days[weekday];
        $('day').text = util.leftpad(day.toString(), 2, ' ');
        $('month').text = months[month];
        $('year').text = year.toString();

    } catch (e) { err(e); }

    // Set battery, bpm, steps and floors
    try {
        $('battery').text = Math.floor(battery.chargeLevel).toString();
        $('bpm').text = bpm ? bpm.toString() : '--';
        $('steps').text = today.adjusted.steps?.toString() || '--';
        $('floors').text = today.adjusted.elevationGain?.toString() || '--';
    } catch (e) { err(e); }

    // Set info
    try {
        if (state === 0) {
            $('info_left').text = "Last sync";
            $('info_right').text = util.ago(me.lastSyncTime);
        }
        else if (state === 1) {
            $('info_left').text = "Memory";
            $('info_right').text = b2kb(memory.js.used) + "/" + b2kb(memory.js.total) + " KB";
        }

    } catch (e) { err(e); }
}
