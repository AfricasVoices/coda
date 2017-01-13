var messageViewerManager = {
    messageContainer: {},
    table: {},
    codeSchemeOrder: [],
    activeScheme: "",
    tablePages: [], // list of objects {start: [sessionIndex, eventIndex], end: [sessionIndex, eventIndex]}
    rowsPerPage : 0,
    currentlyLoadedPages : [],
    wordBuffer: {}, // format {sessionId :{ eventId: {}} ... }

    init: function(messageContainer, data, rowsPerPage) {

        if (rowsPerPage === undefined) rowsPerPage = 40;
        this.rowsPerPage = rowsPerPage;

        this.messageContainer = messageContainer;
        this.table = messageContainer.find("table");
        this.buildTable(data, rowsPerPage);
        this.currentlyLoadedPages.push(0);
        this.currentlyLoadedPages.push(1);

        console.time("dropdown init");
        //var dropdowns = $(".decorator-column").find("select"); // MAJOR BOTTLENECK!!!!!

        /*
        dropdowns.each(function(i, dropdown) {
            $(dropdown).on("change", messageViewerManager.dropdownChange);
        });
        */

        $(document).on("change", function(event) {
           if (event.originalEvent.target.nodeName === "SELECT") {
               messageViewerManager.dropdownChange(event.originalEvent);
           }
        });

        $("#message-table").on("mouseup", function(event) {
            console.log("burek");
            let targetElement = event.originalEvent.target;


            /*
            All this
             */
            if (targetElement.nodeName != "TD") {
                targetElement = targetElement.parentElement;
            }

            if (targetElement.nodeName === "TD" && targetElement.className.split(" ").indexOf("message-text") != -1) {
                messageViewerManager.collectWords(targetElement);
            }
        });

        $("#message-panel").scroll(function(event) {
            //console.log("scroll height: " + $("#message-table")[0].scrollHeight + ", scroll top: " + $("#message-panel").scrollTop() +  ", outer height: " + $("#message-panel").outerHeight(false));
            // todo need to know if scroll is from shortcut or manual
            messageViewerManager.infiniteScroll(event);
        });

        $("#message-table").dblclick(function(event) {
           if (event.originalEvent.target.className === "highlight") {
               $(event.originalEvent.target).replaceWith($(event.originalEvent.target).text());
           }

        });

        console.timeEnd("dropdown init");

        console.time("shortcuts init");
        $(window).on("keypress", this.manageShortcuts);
        console.timeEnd("shortcuts init");

    },

    buildTable: function(data, rowsPerPage) {
        var schemes = newDataset.schemes;
        var eventCount = newDataset.eventCount;
        var decoNumber = Object.keys(schemes).length;
        var decoColumnWidth = (12/decoNumber>>0);
        var bindEditSchemeButtonListener = this.bindEditSchemeButtonListener;
        var messagePanel = this.messageContainer;

        /*
        Build header
         */
        Object.keys(schemes).forEach(function(schemeKey, i) {
            messageViewerManager.codeSchemeOrder.push(schemeKey);

            var decoColumn = $("#header-decoration-column");
            var col = $("<div class='col-md-" + decoColumnWidth + "' scheme='" + schemeKey + "'><i>" + schemes[schemeKey]["name"] + "</i></div>").appendTo(decoColumn.find(".row"));

            var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
                "<i class='glyphicon glyphicon-edit'>" +
                "</i>" +
                "</button>").appendTo(col);

            if (i==0) {
                activeSchemeId = schemeKey;
                messageViewerManager.activeScheme = activeSchemeId;
                col.children("i").css("text-decoration", "underline");
            }
            col.children("i").on("click", messageViewerManager.changeActiveScheme);
            bindEditSchemeButtonListener(button, schemes[schemeKey]);
        });



        /*
        Build rows
         */

        var tbody = "";
        var currentEventCount = 0;
        var pageStartEnd = {start: [0,0], end: []};
        var rowsPerEachPage = Math.floor(rowsPerPage/2) - 1; // to account for zero indexing
        console.time("table building");

        var initialPages = 0;

        /* TODO build indices from where to where each subarray for subsampling is */
        var subsamplingEventCount = 0;
        var subsamplingIndices = [];

        newDataset.sessions.forEach(function(session, sessionIndex) {
            session.events.forEach(function(event, eventIndex) {

                if (subsamplingEventCount == 500) {
                    subsamplingIndices.push([sessionIndex, eventIndex]);
                }

                if (currentEventCount > rowsPerEachPage) {
                    // build new page
                    messageViewerManager.tablePages.push(pageStartEnd);
                    currentEventCount = 1;
                    pageStartEnd = {start: [sessionIndex, eventIndex], end: []};

                    if (initialPages < 2) {
                        initialPages += 1
                        tbody += messageViewerManager.buildRow(event, eventIndex, sessionIndex);

                    } else if (initialPages == 2) {
                        initialPages += 1
                        messageViewerManager.table.find("tbody").append(tbody);
                    }

                } else {
                    // append to old page
                    currentEventCount += 1;
                    pageStartEnd.end = [sessionIndex, eventIndex];
                    if (initialPages < 2) tbody += messageViewerManager.buildRow(event, eventIndex, sessionIndex);

                }

            });

        });

        console.timeEnd("table building");
        scrollbarManager.init(newDataset.sessions, document.getElementById("scrollbar"), 100);

        /*
        ACTIVE ROW HANDLING
        */

        // init
        activeRow = this.table.find("tbody").find("tr:first");
        prevActiveRow = activeRow;
        activeRow.toggleClass("active");


        // click select
        this.table.on('click', 'tbody tr', function() {
            $(this).addClass('active').siblings().removeClass('active');
            prevActiveRow = activeRow;
            activeRow = $(this);
        });


        // keyboard nav
        $(document).on('keydown', function(event) {

            if (!editorOpen && document.activeElement.nodeName === "BODY") {

                if (event.keyCode == 38) { // UP
                    var prev = activeRow.prev();

                    if (prev.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = prev.addClass('active');

                        if (!UIUtils.isRowVisible(prev[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(prev[0], messagePanel[0]);
                        }

                    }
                }

                if (event.keyCode == 40) { // DOWN
                    var next = activeRow.next();

                    if (next.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = activeRow.next().addClass('active');

                        if (!UIUtils.isRowVisible(next[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(next[0], messagePanel[0]);
                        }

                    }
                }
            }

            if (event.keyCode == 13) { // ENTER

                if ($(document.activeElement).is("input")) {
                    return;
                }

                activeRow.toggleClass("active");


                // get next row and make it active
                activeRow = UIUtils.nextUnfilledRow(activeRow, true, activeSchemeId); // todo handle if have to load new page
                activeRow.toggleClass("active");


                var isVisible = UIUtils.isRowVisible(activeRow[0], messagePanel[0]);

                if (!isVisible) {
                    UIUtils.scrollRowToTop(activeRow[0], messagePanel[0]);
                }
            }

        });

    },

    changeActiveScheme : function() {

        $("#header-decoration-column").find("i").not(".glyphicon").css("text-decoration", "");
        $(this).css("text-decoration", "underline");
        activeSchemeId = $(this).parents("div").attr("scheme");
        messageViewerManager.activeScheme = activeSchemeId;

        var schemeObj = schemes[activeSchemeId];
        /*
        $(".message").has("select.coded." + activeScheme).each(function(i, tr) {
            // find code object via selected option
            var color = schemeObj.codes.get($(this).find("option:selected"))["color"];

            $(tr).children("td").each(function(i, td) {
                $(td).css("background-color", color);
            });
        });
        */

        // todo redraw the scrollbar!
        scrollbarManager.redraw(newDataset, activeSchemeId);


        // todo think about whether inactive select should be disabled or just greyed out!


        $(".message").each(function(i, tr) {
            // find code object via selected option
            let selectFields = $(tr).find("select");
            selectFields.each(function(i, field) {

            });
            var selectedOption = $(tr).find("select." + activeSchemeId).find("option:selected").not(".unassign");

            $(tr).find("select").each(function(index,el){
               if ($(el).hasClass(activeSchemeId)) {
                   $(el).removeAttr("disabled");
                   let selectedOption = $(el).find("option:selected").not(".unassign");
                   if (selectedOption.length !== 0) {
                       var color = schemeObj.codes.get(selectedOption.attr("id"))["color"];
                       $(tr).children("td").each(function(i, td) {
                           $(td).css("background-color", color);
                       });
                   } else {
                       $(tr).children("td").each(function(i, td) {
                           $(td).css("background-color", "#ffffff");
                       });
                   }

               } else {
                   $(el).attr("disabled", "");
               }

            });

            /*
            if (selectedOption.length !== 0) {
                var color = schemeObj.codes.get(selectedOption.attr("id"))["color"];
                $(tr).children("td").each(function(i, td) {
                    $(td).css("background-color", color);
                });
            } else {
                $(tr).children("td").each(function(i, td) {
                    $(td).css("background-color", "#ffffff");
                });
            }
            */
        });

    },

    dropdownChange : function(event) {

        let selectElement = $(event.target);

        var schemeId = /form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))[1];
        let value = selectElement.val();
        let row = selectElement.parents(".message");
        let sessionId = $(row).attr("sessionid");
        let eventId = $(row).attr("eventid");

        var eventObj = newDataset.sessions[sessionId]["events"][eventId];
        var codeObj = schemes[schemeId].getCodeByValue(value);

        if (value.length > 0) {

            // add decoration
            let decoration = eventObj.decorationForName(schemeId);
            if (decoration === undefined) {
                eventObj.decorate(schemeId, schemes[schemeId].getCodeByValue(value));
            } else {
                decoration.code = schemes[schemeId].getCodeByValue(value);
            }

            selectElement.removeClass("uncoded");
            selectElement.addClass("coded");

            // set color
            if (activeSchemeId === schemeId) {
                let color = schemes[schemeId].getCodeByValue(value)["color"];
                row.children("td").each(function(i, td) {
                    $(td).css("background-color", color);
                });
            }


            // if words in buffer, add to scheme dataset
            if (messageViewerManager.wordBuffer.hasOwnProperty(sessionId)
                && messageViewerManager.wordBuffer.hasOwnProperty(eventId)
                && messageViewerManager.wordBuffer[sessionId][eventId].length > 0) {

                codeObj.words = Object.keys(messageViewerManager.wordBuffer[sessionId][eventId]);
                messageViewerManager.wordBuffer[sessionId][eventId] = {}
            }


        } else {

            // remove code from event in data structure
            eventObj.uglify(schemeId);

            selectElement.removeClass("coded");
            selectElement.addClass("uncoded");

            if (activeSchemeId === schemeId) {
                row.children("td").each(function (i, td) {
                    $(td).css("background-color", "#ffffff");
                });
            }

            // remove words from dataset, get words from message text
            let words = $(row).find("td.message-text span.highlight").map(function(index, element) {
                console.log($(element).text());
                return $(element).text()});
            //schemes[schemeId].deleteWords(words); // todo keep track which message is the origin of the added words... ?

        }
    },

    addNewSchemeColumn: function(scheme) {

        // TODO: warning message in case of empty codes
        if (scheme["codes"].size === 0) return;

        let tbody = "";
        let sessions = newDataset.sessions;
        let startOfPage = messageViewerManager.tablePages[0].start;
        let endOfPage = messageViewerManager.tablePages[1].end;

        for (let i = startOfPage[0]; i <= endOfPage[0]; i++) {
            let events = sessions[i];
            for (var j = 0; j <= endOfPage[1]; j++) {
                if (i === startOfPage[0] && j < startOfPage[1]) continue;
                else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], j, i);
            }
        }

        this.currentlyLoadedPages[0,1]; // todo store which page was loaded

        var tbodyObj = this.table.find("tbody");
        tbodyObj.empty();
        tbodyObj.append(tbody);
        this.messageContainer.scrollTop(0);

        // Move active row back to top because nothing will have been coded yet
        activeRow.removeClass("active");
        activeRow = $(".message").first().addClass("active");



        /*
        Add decorations to datastructure
         */
        // TODO: happens already, move here
        newDataset.sessions.forEach(function(session) {
            session.events.forEach(function(eventObj) {
               eventObj.decorate(scheme["id"]);
            });
        });


        var decorationCell = $("#header-decoration-column").find(".row");
        var numberOfDecorations = decorationCell.find("div[class*=col-]").length + 1;
        var newDecoColumnWidth = (12/numberOfDecorations>>0);

        /*
        Restructure the header
         */

        var div = ($("<div class='col-md-" + newDecoColumnWidth + "' scheme='" + scheme["id"] + "'><i>" + scheme["name"] + "</i></div>")).appendTo(decorationCell);
        var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
        "<i class='glyphicon glyphicon-edit'>" +
        "</i>" +
        "</button>").appendTo(div);

        div.children("i").on("click", this.changeActiveScheme);
        div.children("i").trigger("click");
        this.bindEditSchemeButtonListener(button, scheme);

        decorationCell.find("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth);

        /*
        Restructure the body
         */
/*
        this.table.find("tbody > tr").each(function(index, row) {
            var decoCell = $(row).children("td:last").find(".row"); // todo rewrite queries

            // keep it a div instead of td so styles dont conflict
            var div = $("<div class='col-md-" + newDecoColumnWidth + "'></div>").appendTo(decoCell);
            var dropdown = $("<select class='form-control " + scheme["id"] + " uncoded'></select>").appendTo(div);

            Array.from(scheme.codes.values()).forEach(function(codeObj) {
                dropdown.append("<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>");
            });

            dropdown.append("<option class='unassign'></option>");
            dropdown.val("");
            dropdown.on("change", messageViewerManager.dropdownChange);
        });

        this.table.find("tbody > tr").each(function(index, row) {
            var decoCell = $(row).children("td:last");
            decoCell.find("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth);
        });
*/
    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");

        $(editButton).on("click", function() {

            var schemeId = $(this).parent().attr("scheme");
            scheme = schemes[schemeId];
            tempScheme = CodeScheme.clone(scheme);

            if (!(codeEditor.is(":visible"))) {

                editorOpen = true;

                Array.from(tempScheme.codes.values()).forEach(function (codeObj, index) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], codeObj["id"], codeObj["words"]);
                });


                var index;
                $(this).closest(".row").find("div").each(function(i, columnDiv) {
                    if ($(columnDiv).text() === scheme["name"])
                        index = i;
                });


                codeEditorManager.bindSaveEditListener();

                $("#scheme-name-input").val(scheme["name"]);
                codeEditor.show();
            }
        });
    },

    manageShortcuts : function(event) {
        if (!editorOpen && activeSchemeId && activeRow && activeSchemeId.length > 0 && activeRow.length) {

            // todo handle datastructure ohhhh


            var shortcuts = schemes[activeSchemeId].getShortcuts();
            if (shortcuts.has(event.keyCode)) {
                var codeObj = shortcuts.get(event.keyCode);
                $(activeRow).children("td").each(function(i, td) {

                    var sessionId = $(td).parent(".message").attr("sessionid");
                    var eventId = $(td).parent(".message").attr("eventid");

                    newDataset.sessions[sessionId]["events"][eventId].decorate(codeObj.owner["id"], codeObj);

                    var color = codeObj["color"];
                    if (color) {
                        $(td).css("background-color", color);
                    } else {
                        $(td).css("background-color", "#ffffff");
                    }
                });

                $(activeRow).removeClass("uncoded");
                $(activeRow).addClass("coded");
                $(activeRow).find("select." + activeSchemeId).val(codeObj["value"]).removeClass("uncoded").addClass("coded");

                var next = UIUtils.nextUnfilledRow(activeRow, true, activeSchemeId);
                if (next.length !== 0) {
                    activeRow.removeClass('active');
                    //activeRow = activeRow.next().addClass('active');
                    activeRow = next.addClass('active');

                    if (!UIUtils.isRowVisible(next[0], messageViewerManager.messageContainer[0])) {
                        UIUtils.scrollRowToTop(next[0], messageViewerManager.messageContainer[0]);
                    }

                } else {
                    // todo handle behaviour when there are no unfilled rows... just proceed to next row
                }
            }
        }
    },

    createPageHTML: function(index) {

        messageViewerManager.currentlyLoadedPages.push(index);
        var tbody = "";
        var sessions = newDataset.sessions;
        var startOfPage = messageViewerManager.tablePages[index].start;
        var endOfPage = messageViewerManager.tablePages[index].end;

        for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
            var events = sessions[i]["events"];
            for (var j = 0; j <= endOfPage[1]; j++) {
                if (i === startOfPage[0] && j < startOfPage[1]) continue;
                else if (j < events.length) tbody += messageViewerManager.buildRow(sessions[i]["events"][j], j, i);
            }
        }

       return tbody;


    },

    infiniteScroll : function(event) {

        // todo on every infinite scroll refresh the scrollthumb position!!!!

        if (UIUtils.isScrolledToBottom(messageViewerManager.messageContainer)) {
            console.time("infinite scroll DOWN");

            var nextPage = messageViewerManager.currentlyLoadedPages[messageViewerManager.currentlyLoadedPages.length-1] + 1;

            if (nextPage < messageViewerManager.tablePages.length) {

                messageViewerManager.currentlyLoadedPages.push(nextPage);

                var tbody = "";
                var sessions = newDataset.sessions;
                var startOfPage = messageViewerManager.tablePages[nextPage].start;
                var endOfPage = messageViewerManager.tablePages[nextPage].end;

                for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
                    var events = sessions[i];
                    for (var j = 0; j <= endOfPage[1]; j++) {
                        if (i === startOfPage[0] && j < startOfPage[1]) continue;
                        else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], j, i);
                    }
                }

                var tbodyElement = messageViewerManager.table.find("tbody");

                var elementsToRemove = tbodyElement.find("tr:nth-child(-n+" + Math.floor(messageViewerManager.rowsPerPage/2) + ")");
                var removedHeight = 0;
                elementsToRemove.each(function(i, el){
                    removedHeight += $(el).height();
                });

                elementsToRemove.remove();
                var newScrollTop = removedHeight - tbodyElement.height();

                tbodyElement.append(tbody);
                console.log("new page added");
                messageViewerManager.currentlyLoadedPages.splice(0,1);


                /*          ADJUST THE OFFSET AGAIN
                 var elementTop = document.getElementById('yourElementId').offsetTop;
                 var divTop = document.getElementById('yourDivId').offsetTop;
                 var elementRelativeTop = elementTop - divTop;
                 */
                newScrollTop >= 0 ? $("#message-panel").scrollTop(newScrollTop) : $("#message-panel").scrollTop(0);

                scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);

                console.timeEnd("infinite scroll DOWN");
            }

        } else if (UIUtils.isScrolledToTop(messageViewerManager.messageContainer)){

            if (messageViewerManager.currentlyLoadedPages[0] !== 0 ) {
                console.time("infinite scroll UP");

                var prevPage = messageViewerManager.currentlyLoadedPages[0] - 1;
                messageViewerManager.currentlyLoadedPages.unshift(prevPage); // put at beginning to preserve ordering

                tbody = "";
                sessions = newDataset.sessions;
                startOfPage = messageViewerManager.tablePages[prevPage].start;
                endOfPage = messageViewerManager.tablePages[prevPage].end;

                /*for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
                    var events = sessions[i];
                    for (var j = 0; j <= endOfPage[1]; j++) {
                        if (i === startOfPage[0]) {
                            if (j <= startOfPage[1]) continue;
                            else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], i, j);
                        }
                    }
                }*/

                for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
                    var events = sessions[i];
                    for (var j = 0; j <= endOfPage[1]; j++) {
                        if (i === startOfPage[0] && j < startOfPage[1]) continue;
                        else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], j, i);
                    }
                }

                tbodyElement = messageViewerManager.table.find("tbody");
                var previousTopRow = tbodyElement.find(".message").first();
                var newScrollTop = 0;
                $(tbody).prependTo(tbodyElement).each(function(i,el) {
                  newScrollTop += $(el).height();
                });
                tbodyElement.find("tr:nth-last-child(-n+" + Math.floor(messageViewerManager.rowsPerPage)/2 + ")").remove();
                messageViewerManager.currentlyLoadedPages.splice(messageViewerManager.currentlyLoadedPages.length-1,1);


                // now need to bring the previous top row back into view
                $("#message-panel").scrollTop(newScrollTop);

                console.timeEnd("infinite scroll UP");



            }
        }

    },

    buildRow : function(eventObj, eventIndex, sessionIndex) {

        var decoNumber = Object.keys(schemes).length;
        var decoColumnWidth = (12/decoNumber>>0);
        var sessionRow = "";
        if (eventObj == undefined) {
            console.log("undefined");
        }

        if (eventObj == undefined) {
            console.log(eventObj);
        }
        var activeDecoration = eventObj["decorations"].get(activeSchemeId);
        var rowColor = "#ffffff";

        // need to check if eventObj has a 'stale' decoration
        // need to perform null checks for code! if event isn't coded yet it has a null code.
        if ( activeDecoration != undefined && activeDecoration.code !== null) {
            var parentSchemeCodes = activeDecoration.code.owner.codes;
            if (!parentSchemeCodes.has(activeDecoration.code.id)) {
                eventObj.uglify(activeDecoration.name);
            } else if (activeDecoration.code.color !== undefined) {
                rowColor = activeDecoration.code.color;
            }
        }

        sessionRow += "<tr class='message' id=" + eventObj["name"] + " eventId = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";
        sessionRow += "<td class='col-md-2' style='background-color: " + rowColor+ "'>" + eventObj["timestamp"] + "</td>";
        sessionRow += "<td class='col-md-4 message-text' style='background-color: " + rowColor+ "'><p>" + eventObj["data"] + "</p></td>";
        sessionRow += "<td class='col-md-4 decorations' style='background-color: " + rowColor+ "'>";
        sessionRow += "<div class='row decorator-column'>";

        Object.keys(newDataset.schemes).forEach(function(schemeKey) {

            var codes = Array.from(newDataset.schemes[schemeKey].codes.values());
            sessionRow += "<div class='col-md-" + decoColumnWidth + " deco-container' scheme='" + activeSchemeId + "'>";

            var optionsString = "";
            var selectClass = "uncoded";
            var somethingSelected = false;

            codes.forEach(function(codeObj) {

                if (eventObj["decorations"].has(schemeKey)) {
                    var currentEventCode = eventObj["decorations"].get(schemeKey).code;
                    if (currentEventCode !== null && currentEventCode["value"] === codeObj["value"]) {
                        optionsString += "<option id='" + codeObj["id"] + "' selected>" + codeObj["value"] + "</option>";
                        selectClass = "coded";
                        somethingSelected = true;
                    } else {
                        optionsString += "<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>";
                    }
                } else {
                    eventObj.decorate(schemeKey);
                    optionsString += "<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>";
                }

            });

            let disabled = schemeKey == messageViewerManager.activeScheme ? "" : "disabled";
            sessionRow += "<select class='form-control " + schemeKey + " " + selectClass + "' " + disabled + ">";
            sessionRow += optionsString;

            if (!somethingSelected) sessionRow += "<option class='unassign' selected></option>";
            else sessionRow += "<option class='unassign'></option>";

            sessionRow += "</select>";
            sessionRow += "</div>";

        });

        sessionRow += "</div>";
        sessionRow += "</td>";
        sessionRow += "</td>";
        sessionRow += "</tr>";

        return sessionRow;
    },

    collectWords : function(element) {

        if ($(element).prop("tagName") == "TD") {

            let highlightContext = $(element);
            let words = [];

            if (window.getSelection && window.getSelection() && window.getSelection().toString().length > 0) {

                let highlightResult = highlightContext.mark(window.getSelection().toString(),  {"element": "span",
                    "className": "highlight", "diacritics": false, "accuracy": "exactly"});
                words = highlightResult["words"];
            }

            console.log(words);

            // check if current row has an assigned code and if yes, add the words to the data structure
            var sessionId = $(element).attr("sessionid");
            var eventId = $(element).attr("eventid");
            let activeDeco = $(element).nextAll("td.decorations").first().find(".deco-container[scheme='"+ messageViewerManager.activeScheme +"']");
            let selectElement = activeDeco.find("select.coded");
            let isCoded = selectElement.length > 0;

            if (isCoded) {

                schemes[messageViewerManager.activeScheme].getCodeByValue(selectElement.val()).words = words;

            } else {
                for (let i = 0; i < words.length; i++){
                    if (messageViewerManager.wordBuffer[sessionId][eventId][words[i]]!= 1) { // todo what do we do about strings of len = 1
                        messageViewerManager.wordBuffer[sessionId][eventId][words[i]] = 1;
                    }
                }
            }
        }


    }

};