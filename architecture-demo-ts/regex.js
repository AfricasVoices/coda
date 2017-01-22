// get an array of words, make a pass through the dataset and find matches in each data line
// if one or more matches, assign the right code to it and highlight the words!

var regexMatcher = {

    findMatches : function(keywords, texts, callback) {

        // todo what kind of stats are we interested in here?
        /*
         Options:
         a) match  vs no match
         b) total number of matches - regardless of keyword
         c) number of keywords matched
         d) what keyword was matched how many times

         */

        let codeId = "bruh";
        console.log("find regex matches");
        //let keywords = code.words;
        let regex = new RegExp('\\b('+keywords.join('|')+')\\b', 'ig');
        for (let i = 0; i < texts.length; i++) {
            let matchCount = this.matchAndHighlight(newDataset.events[i], codeId, regex, true);
            //callback(i,matchCount);
            regexMatcher.codeEvent(newDataset.events[i], schemes["1"].getCodeByValue("Incoming"), matchCount);
        }
        console.timeEnd("find regex matches");

    },

    codeEvent : function(eventObj, code, matchCount) {
        // support for a customised way of calculating confidence and assigning codes...
        if (matchCount.size == 0) return eventObj;

        var eventDeco = eventObj.decorationForName(code.owner.id) == undefined ? null : eventObj.decorationForName(code.owner.id);

        if (eventDeco && (eventDeco["code"] == code)) { // todo do we want more thorough checking???
            // conflict of coding

            if (!eventDeco.manual) {
                // handle conflicting automatic codes
                // option - remove code! keep highlights + colors of the codes!
            }
        }
        else {

            // todo is there a threshold for assigning a code?

            // trigger dropdown change handler

            let selectObj = $(".message[eventid='" + eventObj.name + "']").find("select");
            selectObj.val(code.value);
            messageViewerManager.dropdownChangeHandler(selectObj);

        }

    },

    unwrapHighlights : function(eventRowParagraph) {

        let highlights = $(eventRowParagraph).find(".highlight");
        highlights.each(function(index, highlight) {
            let text = $(highlight).text();
            $(highlight).replaceWith(text);
        });

        $(eventRowParagraph)[0].normalize(); // merges text nodes into one again

        return eventRowParagraph;

    },



    matchAndHighlight : function(eventObj, codeId, regex, highlight) {

        let matches;
        let matchCount = new Map();

        // event object matching this text
        var eventEl = $("#" + eventObj.name).find(".message-text");
        while (matches = regex.exec(eventObj.data)) {

            if (matchCount.has(matches[1])) {
                let matchPosArr = matchCount.get(matches[1]);
                matchPosArr.push(matches.index);
            } else {
                matchCount.set(matches[1], [matches.index]);
            }

            if (highlight) {
                var prevMatchOffset = prevMatchOffset || 0;
                var textNode = textNode ? textNode.splitText(matches.index - prevMatchOffset) : eventEl.find("p").contents()[0].splitText(matches.index);
                let newNode = textNode.splitText(matches[0].length);
                let newSpan = document.createElement("span");
                newSpan.setAttribute("class", "highlight");
                newSpan.setAttribute("codeid", codeId);
                newSpan.textContent = textNode.textContent;
                textNode.parentNode.replaceChild(newSpan, textNode);

                textNode = newNode;
                prevMatchOffset = matches.index + matches[0].length;
            }

        }

        return matchCount;
    },


    highlightKeywords : function(range, surroundingEl, surroundingClass) {

        return function(i, matches) {
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

                        newText += eventElTxt.substring(prev,index);
                        newText += wrapperL + match[0] + wrapperR;
                        prev = index +  match[0].length;
                        matchLen += match[0].length;
                    }

                    if (prev < eventElTxt.length-1) {
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