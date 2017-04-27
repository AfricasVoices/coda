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

/*
REGEX.JS

Handles automated coding by creating and matching regexes.

 */

RegExp.escape = function(text) {
    text = text + "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

var regexMatcher = {

    generateFullTextRegex: function(events) {

        if (events == undefined || !events || events.size === 0) return null;

        let eventTexts = Array.from(events).map((event => { return event["data"]}));
        eventTexts.sort();
        eventTexts = eventTexts.filter((eventText, index) => {
            return eventTexts.indexOf(eventText) === index;
        });

        let uniqueEventTexts = eventTexts.map(eventText => { return RegExp.escape(eventText);});
        //return new RegExp('[\s]*(' + uniqueEventTexts.join('|') + ')[\s]*', 'ig');

        return new RegExp('^\s*(' + uniqueEventTexts.join('|') + ')[\s]*$', 'ig');

    },

    codeEvent: function(eventObj, schemeId, eventWithCodeRegexes) {

        var codes = newDataset.schemes[schemeId].codes;

        if (!eventWithCodeRegexes) {
            eventWithCodeRegexes = {};
            for (let code of codes.entries()) {
                // we only take manually coded events into account when full-text matching
                // hence we only construct the regex at the beginning of recoding since we won't be overriding manual codings
                // whereas automated ones might be changed as we go along
                eventWithCodeRegexes[code[0]] = regexMatcher.generateFullTextRegex(code[1].eventsWithCode.values());
            }
        }

        var confidences = new Map();
        var decoration = eventObj.decorationForName(schemeId);

        if (decoration && decoration.code && !codes.has(decoration.code.id)) {
            // decoration is stale because the code doesn't exist anymore
            eventObj.uglify(schemeId);
        }


        /*
         loop over codes and pick the assignment with the highest confidence
         */
        for (let code of codes.entries()) {

            var fullTextRegex = eventWithCodeRegexes[code[0]]; // regex from full message texts

            if (fullTextRegex) {
                let fullTextMatch = fullTextRegex.exec(eventObj.data + "");
                if (fullTextMatch) {

                    confidences.set(code[0], {"conf":0.95});
                    confidences.get(code[0]).isKeywordMatch = false;
                    confidences.get(code[0]).isFullTextMatch = true;
                    continue;
                }
            }

            // if code has no words assigned
            if (code[1].words.length === 0) continue;

            // generate an OR regex of all words assigned
            let regex = this.generateOrRegex(code[1].words);
            if (regex === null) continue;

            let matchCount = new Map();
            let matches;

            while (matches = regex.exec(eventObj.data + "")) {

                if (matchCount.has(matches[1])) {
                    let matchPosArr = matchCount.get(matches[1]);
                    matchPosArr.push(matches.index);
                } else {
                    matchCount.set(matches[1], [matches.index]);
                }
            }

            confidences.set(code[0], {
                "conf":regexMatcher.confidenceMatchLen(eventObj.data, matchCount),
                "isKeywordMatch":  matchCount.size !== 0,
                "isFullTextMatch": false
            });
            /*
            confidences.get(code[0]).isKeywordMatch = matchCount.size !== 0;
            confidences.get(code[0]).isFullTextMatch = false;
            */
        }

        var maxConfEntry = null;
        for (let entry of confidences.entries()) {
            if (!maxConfEntry) maxConfEntry = entry;
            if (entry[1].conf > maxConfEntry[1].conf) maxConfEntry = entry;
        }

        if (decoration) {
            let manual = (decoration.manual && decoration.manual != undefined) ? decoration.manual : false;

            if (!maxConfEntry && !manual) {
                // automated assignment that doesn't have the highest confidence
                if (decoration.code) {
                    eventObj.uglify(schemeId);
                }
                return;
            }

            if (maxConfEntry && maxConfEntry[1].conf === 0 && !manual && decoration.code) {
                // no coding matches anymore
                eventObj.uglify(schemeId);
                return;
            }

            if (maxConfEntry && !manual && maxConfEntry[1].conf !== decoration.confidence) {
                // override the current automatic code assignment
                if (decoration.code) {
                    eventObj.uglify(schemeId);
                    eventObj.decorate(schemeId, false, codes.get(maxConfEntry[0]), maxConfEntry[1].conf);
                } else {
                    decoration.confidence = maxConfEntry[1].conf;
                    decoration.code = codes.get(maxConfEntry[0]);
                    decoration.manual = false;
                }
            }
        } else {
            if (!maxConfEntry) return;

            if (maxConfEntry[1].conf > 0) {
                eventObj.decorate(schemeId, false, codes.get(maxConfEntry[0]), maxConfEntry[1].conf);
            }
        }
    },

    codeDataset: function (schemeId) {
        console.time("Coding dataset");
        schemeId = schemeId + "";
        let events = newDataset.events;
        let codes = newDataset.schemes[schemeId].codes;
        var sortUtils = new SortUtils();
        var eventWithCodeRegexes = {};
        for (let code of codes.entries()) {
            eventWithCodeRegexes[code[0]] = regexMatcher.generateFullTextRegex(code[1].eventsWithCode.values());
        }

        for (let event of events.values()) {
            this.codeEvent(event, schemeId, eventWithCodeRegexes);
        }
        console.timeEnd("Coding dataset");

        storage.saveDataset(newDataset);
    },

    generateOrRegex: function (wordArray) {

        console.time("Generate or regex");
        if (wordArray.length == 0 || wordArray == null) return null;
        let filtered = wordArray.filter(word => {return word.length > 0});
        console.time("generate or regex");
        return new RegExp('[\\s]*[\#]?\\b(' + filtered.join('|') + ')[\.\,\-\?\)\]*[\\s]*', 'ig');

    },

    wrapText: function (text, regex, wrapClass, codeId) {

        // returns the text to be wrapped with a <p> element and with the appropriate substrings wrapped in <span>
        if (regex == null) return text;
        text = text + "";

        return text.replace(regex, function wrapper(match) {

            let codeIdString = (codeId == 'undefined') ? "" : " codeid='" + codeId + "'";
            return "<span class='" + wrapClass + "'" + codeIdString + ">" + match + "</span>";
        });

    },

    confidenceMatchLen(text, matchCount) {

        text = text + "";
        var matchLength = 0;
        for (let entry of matchCount.entries()) {
            matchLength += entry[0].length * entry[1].length;
        }

        let textLenNoSpaces = text.replace(/ /g, "").length;

        return (matchLength/textLenNoSpaces > 0.95) ? 0.95 : matchLength/textLenNoSpaces;
    },

    unwrapHighlights: function (eventRowParagraph) {

        let highlights = $(eventRowParagraph).find(".highlight");
        highlights.each(function (index, highlight) {
            let text = $(highlight).text();
            $(highlight).replaceWith(text);
        });

        $(eventRowParagraph)[0].normalize(); // merges text nodes into one again

        return eventRowParagraph;

    },


    wrapElement: function (eventObj, regex, codeId) {

        if (regex == null || regex == undefined) return;
        let matches;
        let matchCount = new Map();

        // event object matching this text
        var eventEl = $("#" + eventObj.name).find(".message-text");
        while (matches = regex.exec(eventObj.data + "")) {

            if (matchCount.has(matches[0])) {
                let matchPosArr = matchCount.get(matches[0]);
                matchPosArr.push(matches.index);
            } else {
                matchCount.set(matches[0], [matches.index]);
            }

            var prevMatchOffset = prevMatchOffset || 0;
            var textNode = textNode ? textNode.splitText(matches.index - prevMatchOffset) : eventEl.find("p").contents()[0].splitText(matches.index);
            let newNode = textNode.splitText(matches[0].length);
            let newSpan = document.createElement("span");
            newSpan.setAttribute("class", "highlight");
            if (codeId != undefined) newSpan.setAttribute("codeid", codeId);
            newSpan.textContent = textNode.textContent;
            textNode.parentNode.replaceChild(newSpan, textNode);

            textNode = newNode;
            prevMatchOffset = matches.index + matches[0].length;

        }
        return matchCount;
    }
}