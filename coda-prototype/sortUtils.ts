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

                // same codes, now sort by manual/automatic & confidence
                if (deco1.confidence != null && deco1.confidence != undefined && deco2 != null && deco2.confidence != undefined) {

                    if (deco1.manual != undefined && deco1.manual) {
                        if (deco2.manual != undefined && deco2.manual) {
                            return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                        } else {
                            return 1;
                        }
                    } else if (deco2.manual != undefined && deco2.manual) {
                        return -1;
                    } else {
                        // both automatic
                        return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                    }

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


            // always manual coding behind automatic!
            if (deco1.manual) {

                if (deco2.manual) {
                    return parseInt(e1.name) - parseInt(e2.name);
                }

                // deco2 is before deco1
                return 1;

            } else {
                if (deco2.manual) {

                    // deco1 is before deco2
                    return -1;
                }

                //both are automatic in which case compare confidence!
                return deco1.confidence - deco2.confidence || parseInt(e1.name, 10) - parseInt(e2.name, 10);
            }
        });

        return events;
    }
}