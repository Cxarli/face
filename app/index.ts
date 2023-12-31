import clock from "clock";
import document from "document";
import { me as device } from "device";
import { HeartRateSensor } from "heart-rate";
import { today } from "user-activity";
import { battery, charger } from "power";
import { BodyPresenceSensor } from "body-presence";
import { display } from "display";

import { leftpad, ago, Pauser } from "../common/utils";

clock.granularity = "seconds";


/**
 * Access the element with the given ID
 */
const $ = (() => {
    class Unset {}
    const UNSET = new Unset();

    /**
     * Add a wrapper around the normal Element to cache all .text calls
     * to make sure that nothing on the DOM happens if the value didn't change
     */
    class WrappedElement {
        private _element: Element;
        private _prev_text: string | number | null | undefined | Unset = UNSET;
        private _href?: string;

        constructor(element: Element) {
            this._element = element;
        }

        get element(): Element {
            return this._element;
        }

        get text(): string | number | null | undefined {
            // not set yet, get from actual element
            if (this._prev_text instanceof Unset) return this._prev_text = this._element.text;

            return this._prev_text;
        }

        set text(value: string | number | null | undefined) {
            // Don't change if nothing changed
            if (this._prev_text === value) return;

            this._prev_text = value;

            if (typeof value === 'string') {
                this._element.text = value;
            } else if (typeof value === 'number') {
                this._element.text = value.toString();
            } else if (value === null || typeof value === 'undefined') {
                this._element.text = '??';
            } else {
                throw Error("value is not string, number, null or undefined");
            }
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
let bpm: number | null = null;

try {
    if (!HeartRateSensor) throw new Error("No heart rate sensor detected");

    const hrs: HeartRateSensor = new HeartRateSensor();

    enum reason {
        nobody = 1,
        nodisplay = 2,
    }

    let hrspauser: Pauser<reason> = new Pauser(
        () => { hrs.start(); },
        () => { hrs.stop(); bpm = null; },
    );

    // Listen for heart rate
    hrs.addEventListener('reading', () => { bpm = hrs.heartRate; });
    hrs.start();

    // Pause when not on body
    if (!BodyPresenceSensor) throw new Error("No body presence sensor detected");

    const bps = new BodyPresenceSensor();
    bps.addEventListener('reading', () => { hrspauser.apply(reason.nobody, !bps.present); });
    bps.start();

    // Pause when not displayed
    display.addEventListener('change', () => { hrspauser.apply(reason.nodisplay, !display.on); });

} catch (e) { console.error(e); }


// TODO: use user-chosen locale?
const months: string[] = [
    // January, February, March, April, May, June, July, August,   September, October, November, December
    // Januari, Februari, Maart, April, Mei, June, Juli, Augustus, September, Oktober, November, December
    // January, Februari, Mars,  April, Maj, Juni, Juli, Augusti,  September, Oktober, November, December

    "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

const days: string[] = [
    // Sun=0 .. Sat=7

    // sun, mon,  tues, wednes, thurs,  fri,  satur
    // zon, maan, dins, woens,  donder, vrij, zater
    // sön, mån,  tis,  ons,    tors,   fre,  lör

    "so", "ma", "ti", "wo", "to", "fr", "za",
];


clock.ontick = ({ date }) => {

    // Set time
    try {
        $('hour').text = date.getHours();
        $('minute').text = leftpad(date.getMinutes().toString(), 2, '0');
        $('second').text = leftpad(date.getSeconds().toString(), 2, '0');
    } catch(e) { console.error(e); }

    // Set date
    try {
        $('weekday').text = days[date.getDay()];
        $('day').text = leftpad(date.getDate().toString(), 2, ' ');
        // getMonth() is 0-based, which is good for indexing
        $('monthyear').text = months[date.getMonth()] + " " + date.getFullYear().toString();
    } catch(e) { console.error(e); }

    // Set active zones minutes today
    try {
        // .adjusted is not available for heart rate zones
        const azm = today.local.activeZoneMinutes;

        $('active_fat').text = azm?.fatBurn;

        // FitBit argues that any minute spent in higher zones counts for 2 minute,
        // I argue that's marketing bullshit and we should show the values as they really are
        $('active_cardio').text = azm?.cardio !== undefined ? (azm.cardio / 2) : undefined;
        $('active_peak').text = azm?.peak !== undefined ? (azm?.peak / 2) : undefined;

        // total is fat + 2*cardio + 2*peak so we need to recalculate this ourselves too for the real values
        $('active_total').text = (azm?.fatBurn || 0) + (azm?.cardio || 0) / 2 + (azm?.peak || 0) / 2;

    } catch(e) { console.error(e); }

    // Set battery
    try {
        $('battery').text = battery.chargeLevel;

        // Make it filled when it's charging
        $('battery_image').href = 'assets/icons/stat_am_' + (battery.charging ? 'solid' : 'open') + '_32px.png';

        // Make it red when it's almost empty
        if (battery.chargeLevel <= 25) {
            $style('battery').fill = 'fb-red';
        } else {
            $style('battery').fill = 'fb-white';

            if (battery.charging) {
                // solid
                const goodPower = charger.powerIsGood;

                if (goodPower === true) {
                    $style('battery_image').fill = 'fb-aqua';
                } else if (goodPower === false) {
                    $style('battery_image').fill = 'fb-blue';
                } else {
                    $style('battery_image').fill = 'fb-green';
                }
            } else {
                // open
                $style('battery_image').fill = 'fb-green';
            }
        }
    } catch(e) { console.error(e); }

    // Set bpm, steps, sync
    try {
        $('bpm').text = bpm;

        const adj = today.adjusted;
        $('steps_step').text = adj.steps;
        $('steps_km').text = (today.adjusted.distance !== undefined ? Math.floor(today.adjusted.distance / 1000).toString() : '??') + ' km';

        $('sync').text = ago(device.lastSyncTime);
    } catch(e) { console.error(e); }

    // Easter egg: beating heart on valentine's day
    try {
        // NOTE: getMonth() is 0-based
        if (date.getDay() == 14 && date.getMonth() + 1 == 2) {
            $("bpm_image").href = "assets/icons/stat_hr_solid_32px.png";

            if (date.getSeconds() % 2 == 0) {
                $style("bpm_image").fill = "fb-pink";
            } else {
                $style("bpm_image").fill = "fb-red";
            }
        }
    } catch(e) { console.error(e); }
};
