import clock from "clock";
import document from "document";
import { me } from "device";
import { memory } from "system";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { battery } from "power";
import * as util from "../common/utils";

clock.granularity = "seconds";

// Helper to get an element by ID
// This throws when the ID is not found
function $(id: string): Element {
    const elem = document.getElementById(id);

    if (elem === null) {
        throw new TypeError("Unknown ID");
    }

    return elem;
}

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
let state = 0;
const nr_states = 2;
const sec_p_state = 2;

// @TODO: i18n
const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];


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
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();

        $('day').text = util.leftpad(day.toString(), 2, ' ');
        $('month').text = months[month - 1];
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
        const $info = $('info');

        if (state === 0) {
            $info.text = "Last sync: " + util.ago(me.lastSyncTime);
        }
        else if (state === 1) {
            $info.text = "JS memory: " + memory.js.used + "/" + memory.js.total;
        }

    } catch (e) { err(e); }
}
