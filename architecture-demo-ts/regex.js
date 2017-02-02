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

        return new RegExp(uniqueEventTexts.join("|"), 'i');

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
            for (let code of codes.entries()) {

                let fullTextRegex = eventWithCodeRegexes[code[0]];
                if (fullTextRegex) {
                    let fullTextMatch = fullTextRegex.exec(events[i].data);
                    if (fullTextMatch) {
                        this.codeEvent(events[i], code[1]);
                        continue;
                    }
                }

                let regex = this.generateOrRegex(code[1].words);
                if (regex == null) continue;

                let matchCount = new Map();
                let matches;

                while (matches = regex.exec(events[i].data)) {

                    if (matchCount.has(matches[0])) {
                        let matchPosArr = matchCount.get(matches[0]);
                        matchPosArr.push(matches.index);
                    } else {
                        matchCount.set(matches[0], [matches.index]);
                    }
                }

                this.codeEvent(newDataset.events[i], code[1], matchCount);

            }
        }

    },



    generateOrRegex: function (wordArray) {

        if (wordArray.length == 0 || wordArray == null) return null;

        return new RegExp('\\b(' + wordArray.join('|') + ')\\b', 'ig');
    },

    findMatches: function (keywords, text, visibleRange, eventIndex) {

        // todo what kind of stats are we interested in here?
        /*
         Options:
         a) match  vs no match
         b) total number of matches - regardless of keyword
         c) number of keywords matched
         d) what keyword was matched how many times

         */

        console.log("find regex matches");
        //let keywords = code.words;
        let regex = this.generateOrRegex(keywords);
        let matchCount = new Map();
        let matches;

        while (matches = regex.exec(text)) {

            if (matchCount.has(matches[0])) {
                let matchPosArr = matchCount.get(matches[0]);
                matchPosArr.push(matches.index);
            } else {
                matchCount.set(matches[0], [matches.index]);
            }
        }

        this.codeEvent(newDataset.events[i], entry[1], matchCount);


        //callback(i,matchCount);
        regexMatcher.codeEvent(newDataset.events[i], schemes["1"].getCodeByValue("Incoming"), matchCount);

        console.timeEnd("find regex matches");

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

        var eventDeco = eventObj.decorationForName(code.owner.id) == undefined ? null : eventObj.decorationForName(code.owner.id);

        if (matchCount != undefined && matchCount.size == 0) return eventObj;


        if (eventDeco) {
            if (eventDeco["code"] != code) { // todo do we want more thorough checking???
                // conflict of coding

                if (!eventDeco.manual) {
                    // handle conflicting automatic codes

                    eventObj.uglify(activeSchemeId);
                    if (matchCount == undefined) {
                        // override automatic coding because this is a duplicate of an already coded text
                        eventObj.decorate(code.owner.id, false, code, 0.98);
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
                        eventDeco.confidence = 0.98;
                    } else {
                        eventDeco.confidence = regexMatcher.confidenceMatchLen(eventObj.data, matchCount);
                    }
                }
            }
        }
        else {

            if (matchCount == undefined) {
                // was called because the text is a duplicate of some other already coded text
                eventObj.decorate(code.owner.id, false, code, 0.98);
            }
            else {
                eventObj.decorate(code.owner.id, false, code, regexMatcher.confidenceMatchLen(eventObj.data, matchCount));
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

        return matchLength/textLenNoSpaces;
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
        while (matches = regex.exec(eventObj.data)) {

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
    },


    highlightKeywords: function (range, surroundingEl, surroundingClass) {

        return function (i, matches) {
            if (i >= range[0] && i < range[1]) {

                let eventObj = newDataset.events[i];
                let eventId = eventObj.id;
                let sessionId = eventObj.owner;

                var eventEl = $("#" + eventObj.name).find(".message-text");
                var eventElTxt = eventEl.find("p").text();
                var newText = "";
                var prev = 0;
                var matchLen = 0;

                for (let match of matches.entries()) {
                    var textNode = textNode || eventEl.find("p").contents()[0].splitText(match[1][0]);


                    let wrapperL = (surroundingClass != undefined) ? ("<" + surroundingEl + " class='" + surroundingClass + ">") : "<span>";
                    let wrapperR = "</" + surroundingEl + ">";

                    for (let index of match[1]) {
                        let newNode = textNode.splitText(matchLen + match[0].length);
                        let newSpan = document.createElement(surroundingEl);
                        newSpan.setAttribute("class", surroundingClass);
                        newSpan.textContent = textNode.textContent;
                        textNode.parentNode.replaceChild(newSpan, textNode);

                        textNode = newNode;

                        newText += eventElTxt.substring(prev, index);
                        newText += wrapperL + match[0] + wrapperR;
                        prev = index + match[0].length;
                        matchLen += match[0].length;
                    }

                    if (prev < eventElTxt.length - 1) {
                        newText += eventElTxt.substring(prev);
                    }
                }


                let repl = document.createElement(hEl);
                repl.setAttribute("data-markjs", "true");
                if (surroundingClass) {
                    repl.setAttribute("class", surroundingClass);
                }
                repl.textContent = startNode.textContent;
                startNode.parentNode.replaceChild(repl, startNode);

                eventEl.empty();
                eventEl.append($.parseHTML("<p>" + newText + "</p>"));

            }


        }

    }
}