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
import { run, runv, wraperr } from "../common/utils";
import * as fs from "fs";

clock.granularity = "seconds";

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
const nr_states = 3;
const sec_p_state = 3;

// TODO: use user-chosen locale?
const months: string[] = [
    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

const days: string[] = [
    // Sun..Sat because ISO-8601 is too hard
    "日・にち", "月・げつ", "火・か", "水・すい", "木・もく", "金・きん", "土・ど"
];


// list of all measures battery stats in the last TTL milliseconds
// first item is time in milliseconds, second item is battery percentage
const batteries: Array<[number, number]> = run([], () => {
    interface bat {
        data: Array<[number, number]>,
        version: string,
    }

    const batteries: bat = {
        data: [],
        version: "1.0.0",
    };

    // Constants
    const file = "battery.json";
    const ttl = 10 * 60 * 1000; // 10 minutes in milliseconds
    const writedelay = Number.MAX_SAFE_INTEGER; // don't

    // Try reading from cache
    runv((): void => {
        // Read file. This can throw but that's fine
        const input: bat = fs.readFileSync(file, "json");

        // Compare version string
        if (input.version !== batteries.version) {
            throw new Error(`Battery file version ${input.version} doesn't match own version ${batteries.version}`);
        }

        // Prepend data
        batteries.data = input.data.concat(batteries.data);
    });

    // Write current stats to file
    const write = wraperr(() => {

        console.log("write");

        // write to file
        fs.writeFileSync(file, batteries, "json");
    });

    // Keep track when the last write was to avoid writing too often
    let lastwrite = +new Date;

    // Listen to changes
    battery.onchange = wraperr((_event) => {

        // Get current stats
        const time = +new Date;
        const level = battery.chargeLevel;
        console.log(time + ": " + level + "%");

        // add current level
        batteries.data.push([ time, level ]);

        // remove all levels that expired
        while (batteries.data.length > 0 && batteries.data[0][0] < time - ttl) batteries.data.shift();

        // write if delay has passed
        if (time >= lastwrite + writedelay) {
            write();
            lastwrite = time;
        }
    });

    // Trigger first event
    battery.onchange(<Event> <any> null);

    // Expose data to add
    return batteries.data;
});


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
        $('battery').text = Math.round(battery.chargeLevel).toString();
        // @TODO: Set color of text to red when very low (<20)
    });

    // Set bpm, steps and floors
    runv((): void => {
        $('bpm').text = bpm ? bpm.toString() : '--';
        $('steps').text = today.adjusted.steps?.toString() || '--';
        $('floors').text = today.adjusted.elevationGain?.toString() || '--';
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
        else if (state === 2) {
            $('info_left').text = "%/h";

            if (batteries.length <= 1) {
                // Not enough measurements to calculate
                $('info_right').text = '--';
            } else {
                // Calculate the difference with the average of all measurements in the last 10 minutes
                // then multiply this difference with 2 to make it span the whole duration
                const avg = batteries.reduce((acc, bat) => acc + bat[1], 0) / batteries.length;
                const diff = (batteries[batteries.length - 1][1] - avg) * 2;

                // Get the duration of the timespan
                const timediff = batteries[batteries.length - 1][0] - batteries[0][0];

                // Extrapolate the change in battery per hour
                const batphour = Math.round(diff / (timediff / 3600000));

                // Prefix positive numbers with '+' to make it look neater
                $('info_right').text = (diff > 0 ? "+" : "") + batphour + "%";
            }
        }
    });
});
