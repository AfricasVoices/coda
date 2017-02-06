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

RegExp.escape = function(text) {
    text = text + "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

var regexMatcher = {

    generateFullTextRegex: function(events) {

        if (events == undefined || !events || events.length == 0) return null;

        let eventTexts = events.map((event => { return event["data"]}));
        eventTexts.sort();
        eventTexts = eventTexts.filter((eventText, index) => {
            return eventTexts.indexOf(eventText) === index;
        });

        let uniqueEventTexts = eventTexts.map(eventText => { return RegExp.escape(eventText);});
        //return new RegExp('[\s]*(' + uniqueEventTexts.join('|') + ')[\s]*', 'ig');

        return new RegExp('^\s*(' + uniqueEventTexts.join('|') + ')[\s]*$', 'ig');

    },

    codeDataset: function (schemeId) {

        schemeId = schemeId + "";
        let events = newDataset.events;
        let codes = schemes[schemeId].codes;
        var sortUtils = new SortUtils();
        var eventWithCodeRegexes = {};
        for (let code of codes.entries()) {
            eventWithCodeRegexes[code[0]] = regexMatcher.generateFullTextRegex(code[1].eventsWithCode);
        }

        for (let i = 0; i < events.length; i++) {

            var event = events[i];
            var confidences = new Map();
            var decoration = event.decorationForName(schemeId);

            for (let code of codes.entries()) {

                var fullTextRegex = eventWithCodeRegexes[code[0]];


                /*
                if (decoration) {

                    let manual = (decoration.manual && decoration.manual != undefined) ? decoration.manual : false;
                    if (!manual) {
                        if (fullTextRegex !== null && decoration.code !== null) {
                            event.uglify(code[1].owner.id +"");
                        }
                    }
                }
                */

                if (fullTextRegex) {
                    let fullTextMatch = fullTextRegex.exec(event.data + "");
                    if (fullTextMatch) {

                        confidences.set(code[0], {"conf":0.95});
                        confidences.get(code[0]).isKeywordMatch = false;
                        confidences.get(code[0]).isFullTextMatch = true;
                        //this.codeEvent(events[i], code[1]);
                        continue;
                    }
                }

                let regex = this.generateOrRegex(code[1].words);
                if (regex == null) continue;

                let matchCount = new Map();
                let matches;

                while (matches = regex.exec(event.data + "")) {

                    if (matchCount.has(matches[1])) {
                        let matchPosArr = matchCount.get(matches[1]);
                        matchPosArr.push(matches.index);
                    } else {
                        matchCount.set(matches[1], [matches.index]);
                    }
                }

                confidences.set(code[0], {"conf":regexMatcher.confidenceMatchLen(event.data, matchCount)});
                confidences.get(code[0]).isKeywordMatch = matchCount.size !== 0;
                confidences.get(code[0]).isFullTextMatch = false;


                //this.codeEvent(newDataset.events[i], code[1], matchCount);
            }

            var maxConfEntry = null;
            for (let entry of confidences.entries()) {
                if (!maxConfEntry) maxConfEntry = entry;
                if (entry[1].conf > maxConfEntry[1].conf) maxConfEntry = entry;
            }


            if (decoration) {
                let manual = (decoration.manual && decoration.manual != undefined) ? decoration.manual : false;

                if (!maxConfEntry) {
                    if (decoration.code) {
                        event.uglify(schemeId);
                    }

                    continue;
                }


                if (maxConfEntry[1].conf == 0 && !manual && decoration.code) {
                    // no coding matches anymore
                    event.uglify(schemeId);
                    continue;
                }

                if (!manual && maxConfEntry[1].conf != decoration.confidence) {
                    if (decoration.code) {
                        event.uglify(schemeId);
                        event.decorate(schemeId, false, codes.get(maxConfEntry[0]), maxConfEntry[1].conf);
                    } else {
                        decoration.confidence = maxConfEntry[1].conf;
                        decoration.code = codes.get(maxConfEntry[0]);
                        decoration.manual = false;
                    }
                }
            } else {
                if (!maxConfEntry) continue;

                if (maxConfEntry[1].conf > 0) {
                    event.decorate(schemeId, false, codes.get(maxConfEntry[0]), maxConfEntry[1].conf);
                }

            }



        }
    },

    generateOrRegex: function (wordArray) {

        if (wordArray.length == 0 || wordArray == null) return null;

        return new RegExp('[\\s]*[\#]?\\b(' + wordArray.join('|') + ')[\.\,\-\?\)\]*[\\s]*', 'ig');

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

    codeEvent: function (eventObj, code, matchCount) {
        // support for a customised way of calculating confidence and assigning codes...

        var eventDeco = eventObj.decorationForName(code.owner.id + "") == undefined ? null : eventObj.decorationForName(code.owner.id + "");
        if (matchCount != undefined && matchCount.size == 0) return eventObj;

        if (eventDeco) {
            if (eventDeco["code"] && eventDeco["code"] != code) { // todo do we want more thorough checking???
                // conflict of coding

                if (!eventDeco.manual) {
                    // handle conflicting automatic codes

                    eventObj.uglify(activeSchemeId);
                    if (matchCount == undefined) {
                        // override automatic coding because this is a duplicate of an already coded text
                        eventObj.decorate(code.owner.id + "", false, code, 0.95);
                    } else {
                        // option - remove code! keep highlights + colors of the codes!
                        // todo keep word buffers! per event!
                    }
                }

            } else {
                //todo when does this ever happen?
                if (eventDeco.manual == undefined || !eventDeco.manual) {
                    eventDeco.code = code;
                    eventDeco.manual = false;
                    if (matchCount == undefined) {
                        eventDeco.confidence = 0.95; // todo not sure if this is necessary
                    } else {
                        eventDeco.confidence = regexMatcher.confidenceMatchLen(eventObj.data, matchCount);
                    }
                }
            }
        }
        else {

            if (matchCount == undefined) {
                // was called because the text is a duplicate of some other already coded text
                eventObj.decorate(code.owner.id +"", false, code, 0.95);
            }
            else {
                eventObj.decorate(code.owner.id + "", false, code, regexMatcher.confidenceMatchLen(eventObj.data, matchCount));
            }

        }

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