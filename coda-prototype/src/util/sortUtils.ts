/*
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

class SortUtils {

    static compareCodingMode(a: CodingMode | undefined, b: CodingMode | undefined): number {
        let sortOrder = [undefined, CodingMode.AutoCoded, CodingMode.ExternalTool, CodingMode.Manual];
        return sortOrder.indexOf(a) - sortOrder.indexOf(b);
    }

    static compareName(a: string, b: string): number {
        let intParse1 = parseInt(a);
        let intParse2 = parseInt(b);

        let name1, name2;
        if (isNaN(intParse1)) {
            name1 = a.toLowerCase();
        } else {
            name1 = intParse1;
        }
        if (isNaN(intParse2)) {
            name2 = b.toLowerCase();
        } else {
            name2 = intParse2;
        }

        if (name1 < name2) {
            return -1;
        }
        if (name2 < name1) {
            return 1;
        }

        return 0;
    }

    restoreDefaultSort(events: Array<RawEvent>): Array<RawEvent> {

        events.sort((e1, e2) => {

            let name1 = parseInt(e1.name, 10);
            let name2 = parseInt(e2.name, 10);

            return name1 - name2;

        });

        return events;

    }

    sortEventsByScheme(events: Array<RawEvent>, scheme: CodeScheme, isToDoList: boolean): Array<RawEvent> {

        let schemeId = scheme.id + "";
        let codes = Array.from(scheme.codes.values()).map((code: Code) => {
            return code.value;
        });

        events.sort((e1, e2) => {

            const deco1 = e1.decorationForName(schemeId);
            const deco2 = e2.decorationForName(schemeId);
            const hasCode1 = deco1 ? e1.decorationForName(schemeId).code != null : false;
            const hasCode2 = deco2 ? e2.decorationForName(schemeId).code != null : false;

            let code1 = hasCode1 ? codes.indexOf(e1.decorationForName(schemeId).code.value) : -1;
            let code2 = hasCode2 ? codes.indexOf(e2.decorationForName(schemeId).code.value) : -1;

            if (code1 == -1 && code2 != -1) {
                // one assigned, one unassigned
                return isToDoList ? -1 : 1;
            }

            if (code2 == -1 && code1 != -1) {
                // one assigned, one unassigned
                return isToDoList ? 1 : -1;
            }

            if (code1 == code2) {

                if (code1 == -1) {
                    // neither event has a code assigned
                    return parseInt(e1.name) - parseInt(e2.name);
                }

                // same codes, now sort by coding mode then confidence
                if (deco1.confidence != null && deco1.confidence != undefined && deco2 != null && deco2.confidence != undefined) {
                    let modeDifference = SortUtils.compareCodingMode(deco1.codingMode, deco2.codingMode);

                    if (modeDifference !== 0) {
                        return modeDifference;
                    }
                    return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                }
                // something went wrong and one item doesn't have a confidence!
                else return 0;
            }

            // both have assigned codes that are different
            //return code1 - code2; // todo sort ascending by index of code, which is arbitrary - do we enforce an order?
            return parseInt(e1.name) - parseInt(e2.name);
        });

        return events;
    }

    sortEventsByConfidenceOnly(events: Array<RawEvent>, scheme: CodeScheme): Array<RawEvent> {

        let schemeId = scheme.id + "";

        let codes = Array.from(scheme.codes.values()).map((code: Code) => {
            return code.value;
        });

        events.sort((e1, e2) => {

            let deco1 = e1.decorationForName(schemeId);
            let deco2 = e2.decorationForName(schemeId);

            if (deco1 == deco2 == undefined) {
                return parseInt(e1.name) - parseInt(e2.name);
            }

            if (deco1 == undefined) {
                return -1;
            }

            if (deco2 == undefined) {
                return 1;
            }

            // Sort on coding mode first.
            let modeDifference = SortUtils.compareCodingMode(deco1.codingMode, deco2.codingMode);
            if (modeDifference !== 0) {
                return modeDifference;
            }

            // Sort on confidence if available, otherwise on the event name.
            if (deco1.codingMode === CodingMode.Manual && deco2.codingMode == CodingMode.Manual) {
                return parseInt(e1.name) - parseInt(e2.name);
            } else {
                return deco1.confidence - deco2.confidence || parseInt(e1.name, 10) - parseInt(e2.name, 10);
            }
        });

        return events;
    }
}