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

TABLEUI.JS
Responsible for drawing the main table interface and handling all events related to it:
- sorting
- launching editor
- switching active schemes
- infinite scrolling
- coding by dropdowns
- coding by shortcuts
- checkbox  behaviour
- adding/deleting schemes (i.e. UI changes, the scheme object is manipulated via editorUI)
- collecting words to add to codes

 */

var messageViewerManager = {
    messageContainer: {},
    messageTable: {},
    decorationTable: {},
    codeSchemeOrder: [],
    activeScheme: "",
    tablePages: [], // list of objects {start: [sessionIndex, eventIndex], end: [sessionIndex, eventIndex]}
    rowsInTable: 0,
    lastLoadedPageIndex: 0,
    wordBuffer: {}, // format {sessionId :{ eventId: {}} ... }
    lastTableY: 0,
    isProgramaticallyScrolling: false,
    sortUtils: new SortUtils(),
    currentSort: null,
    firstScheme: "",
    horizontal: true,
    initialMessageTableWidth: 800,

    init: function(messageContainer, data, rowsInTable) {

        if (!rowsInTable) rowsInTable = 40;
        this.rowsInTable = rowsInTable;

        this.messageContainer = messageContainer;
        this.messageTable = $("#message-table");
        this.decorationTable = $("#deco-table");
        this.lastLoadedPageIndex = 1;
        this.currentSort = this.sortUtils.restoreDefaultSort;

        if (!data) {
            this.buildTable();

        } else {
            newDataset.restoreDefaultSort();
            this.buildTable(data, rowsInTable);
            if (Object.keys(newDataset.schemes).length > 4) {
                //$("#message-viewer").css("width", (1230 + (Object.keys(newDataset.schemes).length - 4) * 360) + "");
            }

            //scrollbarManager.init(newDataset.sessions, document.getElementById("scrollbar"), 100);

            console.time("dropdown init");

            $(document).on("change", function(event) {
                if (!event.originalEvent) return;

                if (event.originalEvent.target.nodeName === "SELECT") {
                    messageViewerManager.dropdownChange(event.originalEvent, true);
                } else if (event.originalEvent.target.nodeName === "INPUT" && event.originalEvent.target.className === "checkbox-manual") {
                    messageViewerManager.checkboxHandler(event);
                }
            });

            this.messageTable.on("mouseup", function(event) {
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

            $("#message-panel").on("scroll", (throttle(function(event) {
                //console.log("scroll height: " + $("#message-table")[0].scrollHeight + ", scroll top: " + $("#message-panel").scrollTop() +  ", outer height: " + $("#message-panel").outerHeight(false));
                // todo need to know if scroll is from shortcut or manual
                messageViewerManager.infiniteScroll(event);

            }, 1)));

            $("#message-panel").on("scroll", function() {
                let yDifference = (messageViewerManager.lastTableY - messageViewerManager.messageContainer.scrollTop()) / messageViewerManager.messageTable.height();
                scrollbarManager.redrawThumb(scrollbarManager.getThumbPosition() - scrollbarManager.scrollbarEl.height * yDifference * (messageViewerManager.rowsInTable / newDataset.eventOrder.length));

                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
            });

            this.messageTable.dblclick(function(event) {
                if (event.originalEvent.target.className === "highlight") {
                    // open editor
                    let scheme = $(event.originalEvent.target).attr("codeid").split("-")[0];
                    $(".scheme-header[scheme='" + scheme + "']").find(".edit-scheme-button").trigger("click");
                }
            });

            $(".sort-btn").off("click");
            $(".sort-btn").on("click", messageViewerManager.sortHandler);

            console.timeEnd("dropdown init");
            console.time("shortcuts init");
            $(window).on("keypress", this.manageShortcuts);
            console.timeEnd("shortcuts init");

        }
    },

    sortHandler: function(event) {

        // sorting by another column currently doesn't change the active scheme

        console.time("sort");

        var iconClassesNext = {
            "icon-def": "icon-cat", // current: default on-load order
            "icon-cat": "icon-conf", // current: sort by code + conf
            "icon-conf": "icon-def" // current: sort by confidence - when we want global minimum confidence
        };

        $(".sort-btn").find("div.active").toggleClass("active");

        var targetElement = event.originalEvent.target;
        var elementClass;
        if (targetElement.nodeName === "DIV") {
            elementClass = targetElement.className.split(" ")[0];
        } else if (targetElement.nodeName === "BUTTON") {
            elementClass = "sort-btn";
        }

        if (elementClass === "sort-btn" || elementClass === "sort-icon") {
            // find which icon was clicked and use the appropriate sort

            let iconClassName = elementClass === "sort-btn" ? $(targetElement).children(".sort-icon")[0].className.split(" ")[1] : targetElement.className.split(" ")[1];
            let schemeId = $(targetElement).parents(".scheme-header").attr("scheme");

            if (iconClassName === "icon-cat") {
                newDataset.sortEventsByConfidenceOnly(schemeId);
                messageViewerManager.currentSort = messageViewerManager.sortUtils.sortEventsByConfidenceOnly;

            } else if (iconClassName === "icon-def") {
                newDataset.sortEventsByScheme(schemeId, true);
                messageViewerManager.currentSort = messageViewerManager.sortUtils.sortEventsByScheme;

            } else if (iconClassName === "icon-conf") {
                newDataset.restoreDefaultSort();
                messageViewerManager.currentSort = messageViewerManager.sortUtils.restoreDefaultSort;

            }

            // switch icons and assign active sort class
            if (elementClass === "sort-btn") {
                let icon = $(targetElement).children(".sort-icon")[0];
                icon.className = icon.className.replace(iconClassName, iconClassesNext[iconClassName] + " active");
            } else {
                targetElement.className = targetElement.className.replace(iconClassName, iconClassesNext[iconClassName] + " active");
            }

            // redraw body, PRESERVE ACTIVE ROW
            messageViewerManager.messageTable.find("tbody").empty();
            messageViewerManager.decorationTable.find("tbody").empty();
            messageViewerManager.bringEventIntoView2(activeRow.attr("eventid"));

            // redraw scrollbar
            scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
            scrollbarManager.redrawThumbAtEvent(newDataset.eventOrder.indexOf(activeRow.attr("eventid")));

            // update the activity stack
            storage.saveActivity({
                "category": "DATASET",
                "message": "Sorted dataset", // todo enter what sort
                "messageDetails": iconClassesNext[iconClassName],
                "data": "",
                "timestamp": new Date()
            });
        }
        console.timeEnd("sort");
    },

    restorePreviousPosition: function() {

        let tbody = "";
        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < messageViewerManager.lastLoadedPageIndex * halfPage + halfPage; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner);
        }

        $(messageViewerManager.messageTable.find("tbody").empty()).append(tbody);
        // todo adjust scroll offset appropriately!

        scrollbarManager.redraw(newDataset, this.activeScheme);

    },

    buildTable: function(data, rowsPerPage, hasDataChanged) {
        if (!data) {

            let tableTbody = messageViewerManager.messageTable.find("tbody");
            tableTbody.append("<tr><td colspan='3'>Start by loading in data from Dataset menu</td></tr>");
            return;
        }

        if (hasDataChanged == null) {
            // checks if this is a result of UNDO/REDO action or new data was loaded in
            hasDataChanged = true;
        }

        /*
        Reset all css set when resizing programatically
         */
        if (hasDataChanged) {
            $("#message-viewer").css("width", "");
            messageViewerManager.decorationTable.css("width", "auto");
            messageViewerManager.decorationTable.find("thead").css("width", "");
            messageViewerManager.messageTable.css("width", messageViewerManager.initialMessageTableWidth);
        }

        /*
        Assume initial scheme order and active scheme
         */
        let schemeOrder = Object.keys(data.schemes);
        let activeScheme = schemeOrder[0];

        this.codeSchemeOrder = schemeOrder;
        this.activeScheme = activeScheme;

        /*
        Build headers
         */
        console.time("header building");

        let activeSchemeHeader = $("#active-scheme-header");
        activeSchemeHeader.empty();
        let otherSchemeHeaders = $("#decorations-header");
        otherSchemeHeaders.empty();

        // establish sorting
        let activeSortIcon = "icon-def'";
        if (!hasDataChanged && data.schemes[messageViewerManager.activeScheme]) {
            if (this.currentSort === this.sortUtils.sortEventsByConfidenceOnly) {
                activeSortIcon = "icon-conf'";
                newDataset.sortEventsByConfidenceOnly(messageViewerManager.activeScheme);
            }
            if (this.currentSort === this.sortUtils.sortEventsByScheme) {
                activeSortIcon = "icon-cat'";
                newDataset.sortEventsByScheme(messageViewerManager.activeScheme, true);
            }
            if (this.currentSort === this.sortUtils.restoreDefaultSort) {
                activeSortIcon = "icon-def'";
                newDataset.restoreDefaultSort();
            }
        }

        if (hasDataChanged) {
            newDataset.restoreDefaultSort();
        }

        let activeSchemeHeaderToAppend = this.buildSchemeHeaderElement(activeScheme, activeSortIcon, true);
        let appendedActiveSchemeHeader = $(activeSchemeHeaderToAppend).appendTo(activeSchemeHeader);
        let decorationsHeader = messageViewerManager.buildDecorationsHeader(messageViewerManager.codeSchemeOrder.slice(1), activeSortIcon, otherSchemeHeaders);

        let allSchemeHeaders;

        if (decorationsHeader && decorationsHeader.length > 0) {
            let appendedOtherSchemeHeaders = decorationsHeader.appendTo(otherSchemeHeaders);
            allSchemeHeaders = appendedActiveSchemeHeader.add(appendedOtherSchemeHeaders);
        } else {
            allSchemeHeaders = appendedActiveSchemeHeader;
        }

        // setup listeners
        allSchemeHeaders.each((i, col) => {
            let column = $(col);
            let schemeKey = column.attr("scheme");
            let button = column.find(".edit-scheme-button");
            messageViewerManager.bindEditSchemeButtonListener(button, newDataset["schemes"][schemeKey]);
        });

        allSchemeHeaders.find("i.scheme-name").on("click", event => {
            let schemeHeaderContainer = $(event.target).parents(".scheme-header"); // coding scheme header - container for buttons and name of particular scheme
            let schemeId = schemeHeaderContainer.attr("scheme");
            setTimeout(() => {
                console.log("Changing active scheme");
                messageViewerManager.changeActiveScheme(schemeId);
                messageViewerManager.resizeViewport();
            }, 500);
        });

        // init header tooltips
        let sortButtons = $(".sort-btn");

        sortButtons.tooltip();
        $(".edit-scheme-button").tooltip();

        // sort handler binding
        sortButtons.off("click");
        sortButtons.on("click", messageViewerManager.sortHandler);
        console.timeEnd("header building");

        /*
        Build rows
         */
        console.time("table building");

        let activeMessageTableTbody = "";
        let decorationTableTbody = "";

        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        if (hasDataChanged) {
            messageViewerManager.lastLoadedPageIndex = 1;
        }

        let iterationStop = messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.eventOrder.length ? newDataset.eventOrder.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;
        for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < iterationStop; i++) {
            let eventIndex = newDataset.eventOrder[i];
            let eventObj = newDataset.events.get(eventIndex);
            activeMessageTableTbody += messageViewerManager.buildMessageTableRow(eventObj, i, eventObj.owner, messageViewerManager.activeScheme);
            decorationTableTbody += messageViewerManager.buildDecorationTableRow(eventObj, i, eventObj.owner, messageViewerManager.codeSchemeOrder.slice(1));
        }

        let messageTableBodyElement = messageViewerManager.messageTable.find("tbody");
        let decorationTableBodyElement = messageViewerManager.decorationTable.find("tbody");

        let prevScroll = this.messageContainer.scrollTop();
        messageTableBodyElement.empty();
        decorationTableBodyElement.empty();

        let activeMessageRows = $(activeMessageTableTbody).appendTo(messageTableBodyElement);
        if (decorationTableTbody.length > 0) {
            let decoRows = $(decorationTableTbody).appendTo(decorationTableBodyElement);
            messageViewerManager.decorationTable.show();
            $("body").show();
            for (let i = 0; i < activeMessageRows.length; i++) {
                // need to adjust heights so rows match in each table
                let outerHeight = $(activeMessageRows[i]).outerHeight();
                $(decoRows[i]).outerHeight(outerHeight);
            }
            $("body").hide();
        } else {
            // if only one scheme (= the active one), hide deco table and expand the message one
            messageViewerManager.decorationTable.hide();
            messageViewerManager.messageTable.css({"width": "100%"});
        }

        if (hasDataChanged) {
            this.messageContainer.scrollTop(0);
        } else {
            this.messageContainer.scrollTop(prevScroll);
        }

        console.timeEnd("table building");

        /*
        Scrollbar
         */
        if (!hasDataChanged) {
            scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme ? messageViewerManager.activeScheme : Object.keys(newDataset.schemes)[0]);
        } else {
            // todo take care to clear previous one
            scrollbarManager.init(newDataset.sessions, document.getElementById("scrollbar"), 100);
        }

        /*
        Active row handling
        */
        // init
        activeRow = this.messageTable.find("tbody").find("tr:first");
        activeRow.toggleClass("active");

        // select on click
        this.messageTable.add(this.decorationTable).on("click", "tbody tr", function() {
            let eventId = $(this).attr("eventid");
            let newActiveRow = messageViewerManager.messageTable.find("tbody tr[eventid='" + eventId + "']");
            newActiveRow.addClass("active").siblings().removeClass("active");
            activeRow = newActiveRow;
        });

        // keyboard nav
        $(document).off("keydown");
        $(document).on("keydown", function(event) {

            if (!editorOpen && document.activeElement.nodeName === "BODY") {
                let messagePanel = messageViewerManager.messageContainer;
                if (event.keyCode === 38) { // UP
                    var prev = activeRow.prev();

                    if (prev.length !== 0) {
                        activeRow.removeClass("active");
                        activeRow = prev.addClass("active");

                        if (!UIUtils.isRowVisible(prev[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(prev[0], messagePanel[0]);
                        }

                    }
                }

                if (event.keyCode === 40) { // DOWN
                    var next = activeRow.next();

                    if (next.length !== 0) {
                        activeRow.removeClass("active");
                        activeRow = activeRow.next().addClass("active");

                        if (!UIUtils.isRowVisible(next[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(next[0], messagePanel[0]);
                        }

                    }
                }

                if (event.keyCode === 13) { // ENTER

                    if ($(document.activeElement).is("input")) {
                        return;
                    }

                    if (messageViewerManager.horizontal) {
                        /*
                        setTimeout(() => {
                            messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
                        }, 500);
                        */
                        messageViewerManager.horizontalCoding(activeRow.attr("eventid"));

                    } else {
                        /*
                        setTimeout(() => {
                            messageViewerManager.verticalCoding(activeRow.attr("eventid"));
                        }, 500);
                        */
                        messageViewerManager.verticalCoding(activeRow.attr("eventid"));

                    }
                }

            }

        });

        /*
        Adjust width - have to scroll horizontally if screen is too small
        */

        /*
        if ($(".scheme-header:first").outerWidth() <= 180 && Object.keys(newDataset.schemes).length > 4) {
            let outerContainer = $("#message-viewer");
            let current = outerContainer.outerWidth();
            outerContainer.outerWidth(current + ((Object.keys(newDataset.schemes).length - 4) * 400));
        }
        */

    },

    buildDecorationsHeader: function(orderedSchemes, activeSortIcon, decorationsHeader) {

        return getDividedHeaderColumns(orderedSchemes, activeSortIcon, decorationsHeader);

        function getDividedHeaderColumns(orderedSchemes, activeSortIcon, decorationsParent) {

            let decorationsParentElement = $(decorationsParent);
            let schemeNumber = orderedSchemes.length;
            let colAttrNum;
            let dividedHeaders = "";

            if (schemeNumber >= 1 && 12 >= schemeNumber) {
                switch (schemeNumber) {
                    case(5):
                        decorationsParentElement.addClass("five-cols");
                        colAttrNum = 1;
                        break;
                    case(7):
                        decorationsParentElement.addClass("seven-cols");
                        colAttrNum = 1;
                        break;
                    case(8):
                        decorationsParentElement.addClass("eight-cols");
                        colAttrNum = 1;
                        break;
                    case(9):
                        decorationsParentElement.addClass("nine-cols");
                        colAttrNum = 1;
                        break;
                    case(10):
                        decorationsParentElement.addClass("ten-cols");
                        colAttrNum = 1;
                        break;
                    case(11):
                        decorationsParentElement.addClass("eleven-cols");
                        colAttrNum = 1;
                        break;
                    default:
                        colAttrNum = 12 / schemeNumber >> 0;
                }

                orderedSchemes.forEach(schemeKey => {
                    console.log("schemeKey", schemeKey);
                    let schemeObj = newDataset.schemes[schemeKey];

                    let sortIcon = "<button class='sort-btn btn btn-default btn-xs' data-toggle='tooltip' data-placement='top' title='Sort messages' data-container='body'><div class='sort-icon " + (schemeKey === messageViewerManager.activeScheme ? activeSortIcon + "'" : "icon-def active'") + "></div></button>";
                    let editButton = "<button type='button' class='btn btn-default btn-xs edit-scheme-button' data-toggle='tooltip' data-placement='top' title='Edit scheme' data-container='body'><i class='glyphicon glyphicon-edit'></i></button>";
                    let columnDiv = "<th class='col-md-" + colAttrNum + " col-xs-" + colAttrNum + " scheme-header' scheme='" + schemeKey + "'><div>" + sortIcon + editButton + "</div><div class='scheme-name-cont'><i class='scheme-name'>" + schemeObj["name"] + "</i></div>" + "</th>";
                    dividedHeaders += columnDiv;
                });

                return $(dividedHeaders);

            } else if (schemeNumber > 12) {

                let decoCol1 = $("<div class='col-md-6 col-sm-6 col-lg-6 col-xs-6'></div>");
                $(this.decoHeaderColumn(orderedSchemes.slice(0, schemeNumber / 2 >> 0), activeSortIcon, decoCol1)).appendTo(decoCol1);

                let decoCol2 = $("<div class='col-md-6 col-sm-6 col-lg-6 col-xs-6'></div>");
                $(this.decoHeaderColumn(orderedSchemes.slice(schemeNumber / 2 >> 0), activeSortIcon, decoCol2)).appendTo(decoCol2);
                return decoCol1 + decoCol2;
            }

        }

    },

    buildSchemeHeaderElement: function(schemeKey, activeSortIcon, isActiveScheme) {

        let activeSchemeClass = "";
        if (isActiveScheme) {
            activeSchemeClass = " active-scheme";
        }

        let schemeObj = newDataset.schemes[schemeKey];

        let sortIcon = "<button class='sort-btn btn btn-default btn-xs' data-toggle='tooltip' data-placement='top' title='Sort messages' data-container='body'><div class='sort-icon " + (schemeKey === messageViewerManager.activeScheme ? activeSortIcon + "'" : "icon-def active'") + "></div></button>";
        let editButton = "<button type='button' class='btn btn-default btn-xs edit-scheme-button' data-toggle='tooltip' data-placement='top' title='Edit scheme' data-container='body'><i class='glyphicon glyphicon-edit'></i></button>";
        let columnDiv = "<th class='scheme-header' scheme='" + schemeKey + "'><div>" + sortIcon + editButton + "</div><div class='scheme-name-cont'><i class='scheme-name" + activeSchemeClass + "'>" + schemeObj["name"] + "</i></div></th>";
        return columnDiv;
    },

    changeActiveScheme: function(schemeId) {
        if (messageViewerManager.activeScheme === schemeId) {
            // Changing to the currently active scheme, so no need to do any work.
            return;
        }

        if (!schemeId) {
            /*
            Circular
             */

            let nextActiveScheme = messageViewerManager.codeSchemeOrder[1];

            messageViewerManager.demoteFromActiveScheme(messageViewerManager.activeScheme, true);
            messageViewerManager.promoteToActiveScheme(nextActiveScheme);

            let movedSchemeKey = messageViewerManager.codeSchemeOrder.splice(0, 1)[0]; // remove previous active scheme key
            messageViewerManager.codeSchemeOrder.push(movedSchemeKey); // append it at the end

            activeSchemeId = nextActiveScheme;
            messageViewerManager.activeScheme = nextActiveScheme;

        } else {
            /*
            New scheme is pushed on top, the previous active one just moves one space down
             */

            messageViewerManager.demoteFromActiveScheme(messageViewerManager.activeScheme, false);
            messageViewerManager.promoteToActiveScheme(schemeId);

            let indexOfScheme = messageViewerManager.codeSchemeOrder.indexOf(schemeId);
            let movedSchemeKey = messageViewerManager.codeSchemeOrder.splice(indexOfScheme, 1)[0]; // remove active scheme key
            messageViewerManager.codeSchemeOrder.splice(0, 0, movedSchemeKey); // insert it at the beginning

            activeSchemeId = schemeId;
            messageViewerManager.activeScheme = schemeId;
            messageViewerManager.firstScheme = messageViewerManager.activeScheme;
        }

        let thumbPos = scrollbarManager.getThumbPosition();
        scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
        scrollbarManager.redrawThumb(thumbPos);

    },

    undoHandler: function() {
        let undone = undoManager.undo(messageViewerManager);
        if (undone) {
            console.log("Undone! " + "Stack pt: " + undoManager.pointer + " Stack size: " + undoManager.modelUndoStack.length);

            let newOrder = messageViewerManager.codeSchemeOrder.filter(schemeKey => !!newDataset.schemes[schemeKey]); // leave ones that are in dataset schemes
            Object.keys(newDataset.schemes).forEach(schemeKey => {
                if (newOrder.indexOf(schemeKey) === -1) {
                    newOrder.push(schemeKey);
                }
            });
            messageViewerManager.codeSchemeOrder = newOrder;
            this.buildTable(newDataset, this.rowsInTable, false);
            // todo undo manager to storage

            // update the activity stack // TODO what to save here
            storage.saveActivity({
                "category": "DATASET",
                "message": "Undone action",
                "messageDetails": "button",
                "data": "",
                "timestamp": new Date()
            });
        }
    },

    redoHandler: function() {
        let redone = undoManager.redo(messageViewerManager);
        if (redone) {
            console.log("Redone! " + "Stack pt: " + undoManager.pointer + " Stack size: " + undoManager.modelUndoStack.length);

            let newOrder = messageViewerManager.codeSchemeOrder.filter(schemeKey => !!newDataset.schemes[schemeKey]); // leave ones that are in dataset schemes
            Object.keys(newDataset.schemes).forEach(schemeKey => {
                if (newOrder.indexOf(schemeKey) === -1) {
                    newOrder.push(schemeKey);
                }
            });
            messageViewerManager.codeSchemeOrder = newOrder;
            this.buildTable(newDataset, this.rowsInTable, false);
            // todo undo manager to storage

            // update the activity stack // TODO what data to save here
            storage.saveActivity({
                "category": "DATASET",
                "message": "Redone action",
                "messageDetails": "button",
                "data": "",
                "timestamp": new Date()
            });
        }
    },

    dropdownChangeHandler: function(selectElement, manual) {

        if (typeof manual === "undefined") manual = true;
        if (!/form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))) {
            console.log("?");
        }

        var schemeId = /form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))[1];
        let value = selectElement.val();
        let row = selectElement.parents(".message-row");
        let sessionId = $(row).attr("sessionid");
        let eventId = $(row).attr("eventid");
        let checkbox = selectElement.siblings("span").find(".checkbox-manual");

        var eventObj = newDataset.events.get(eventId);
        var codeObj = newDataset.schemes[schemeId].getCodeByValue(value);

        if (value.length > 0) {
            // CODED

            // add decoration
            let decoration = eventObj.decorationForName(schemeId);
            if (decoration === undefined) {
                eventObj.decorate(schemeId, manual, UUID, newDataset.schemes[schemeId].getCodeByValue(value), 0.95); // todo fix codeObj
            } else {
                decoration.code = newDataset.schemes[schemeId].getCodeByValue(value);
                decoration.manual = manual;
                decoration.confidence = 0.95;
                decoration.author = UUID;
                decoration.code.addEvent(eventObj);
            }

            selectElement.removeClass("uncoded");
            selectElement.addClass("coded");

            // set color
            if (messageViewerManager.activeScheme === schemeId) {
                let color = newDataset.schemes[schemeId].getCodeByValue(value)["color"];
                row.children("td").each(function(i, td) {
                    if ($(td).hasClass("message-text")) {
                        if (color && color.length !== 0 && color !== "#ffffff") {
                            $(td).css("box-shadow", "inset 0px 0px 0px 4px " + color);
                        }
                    } else {
                        if (color && color.length !== 0) {
                            $(td).css("background-color", color);
                        } else {
                            $(td).css("background-color", "#ffffff");
                        }
                    }

                });
            }

            // check checkbox
            checkbox.prop("checked", true);

            // if words in buffer, add to scheme dataset
            if (messageViewerManager.wordBuffer.hasOwnProperty(sessionId)
                && messageViewerManager.wordBuffer.hasOwnProperty(eventId)
                && messageViewerManager.wordBuffer[sessionId][eventId].length > 0) {

                codeObj.addWords(Object.keys(messageViewerManager.wordBuffer[sessionId][eventId]));
                messageViewerManager.wordBuffer[sessionId][eventId] = {};
            }

            regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(codeObj.words), codeObj.id);

        } else {
            // UNCODED

            // remove code from event in data structure
            eventObj.uglify(schemeId);

            selectElement.removeClass("coded");
            selectElement.addClass("uncoded");

            // recolor
            if (messageViewerManager.activeScheme === schemeId) {
                row.children("td").each(function(i, td) {
                    if ($(td).hasClass("message-text")) {
                        $(td).css("box-shadow", "");
                    } else {
                        $(td).css("background-color", "#ffffff");
                    }
                });
            }

            // uncheck checkbox
            checkbox.prop("checked", false);

            // remove words from dataset, get words from message text
            let words = $(row).find("td.message-text span.highlight").map(function(index, element) {
                console.log($(element).text());
                return $(element).text();
            });
            //schemes[schemeId].deleteWords(words); // todo keep track which message is the origin of the added words... ?
        }

        /*
        Re-sort the dataset and re-draw the table when sorting by confidence/category so items jump to their place!
        Not re-sorting in case of "default" sort because that's not affected by coding

        IMPORTANT - not re-sorting if event was 'uncoded' since then an automated coding will be assigned and item will jump
        and effectively 'hide' to a place that the user can't predict
         */

        if (!messageViewerManager.horizontal) {

            if (messageViewerManager.currentSort !== messageViewerManager.sortUtils.restoreDefaultSort && value.length > 0) {

                if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
                    newDataset.sortEventsByConfidenceOnly(schemeId);
                }
                if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByScheme) {
                    newDataset.sortEventsByScheme(schemeId, true);
                }

                /*
                 redraw body
                 */
                let tbody = "";
                let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);

                let iterationStop = messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.eventOrder.length ? newDataset.eventOrder.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;

                for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < iterationStop; i++) {
                    let eventKey = newDataset.eventOrder[i];
                    tbody += messageViewerManager.buildRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner);
                }

                $(messageViewerManager.messageTable.find("tbody").empty()).append(tbody);

                /*
                 refresh scrollbar
                 */
                var thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
                scrollbarManager.redrawThumb(thumbPos);
            }

            setTimeout(() => {
                messageViewerManager.verticalCoding(eventId);
            }, 250);

        } else {
            /*
      setTimeout(() => {
      messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
      }, 500);
      */
            messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
        }

        undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

        // update the activity stack
        storage.saveActivity({
            "category": "CODING",
            "message": "Used dropdown to assign code from scheme",
            "messageDetails": {"code": codeObj ? codeObj.id : "uncoded", "scheme": schemeId},
            "data": eventObj,
            "timestamp": new Date()
        });
    },

    dropdownChange: function(event, manual) {

        let selectElement = $(event.target);
        messageViewerManager.dropdownChangeHandler(selectElement, manual);
    },

    updateRowHtml(messageRow, activeScheme) {

        messageRow = $(messageRow);
        let eventObj = newDataset.events.get(messageRow.attr("eventid"));
        if (eventObj) {
            let deco = eventObj.decorations.get(activeScheme);
            if (deco && deco.code) { // it's coded
                let color = deco.code.color;
                if (!color || color.length === 0) {
                    color = "#ffffff";
                }
                let idCol = messageRow.find(".message-id");
                let messageCol = messageRow.find(".message-text");
                let decoCol = messageRow.find(".decorations");

                idCol.css({"background-color": color});
                if (color !== "#fffffff") {
                    messageCol.css({"box-shadow": "inset 0px 0px 0px 4px " + color});
                } else {
                    messageCol.css({"box-shadow": ""});
                }
                decoCol.css({"background-color": color});

                // update dropdown to the right value
                let select = messageRow.find("select." + activeScheme);
                select.find("option").attr("selected", false);
                select.find("#" + deco.code.id).attr("selected", true);

            } else { // not coded anymore
                let color = "#ffffff";
                let idCol = messageRow.find(".message-id");
                let messageCol = messageRow.find(".message-text");
                let decoCol = messageRow.find(".decorations");

                idCol.css({"background-color": color});
                messageCol.css({"box-shadow": ""});
                decoCol.css({"background-color": color});

                // deselect the dropdown
                let select = messageRow.find("select." + activeScheme);
                select.find("option").attr("selected", false);
                select.find("option.unassign").attr("selected", true);
                select.removeClass("coded");
                select.addClass("uncoded");
            }
        }
    },

    checkboxHandler(DOMevent) {

        let checkbox = $(DOMevent.target);
        let messageRow = checkbox.parents(".message-row");
        let eventKey = messageRow.attr("eventid");
        let eventObj = newDataset.events.get(eventKey);
        let codeObj = eventObj.decorations.get(messageViewerManager.activeScheme);

        // make this row active
        activeRow.removeClass("active");
        activeRow = messageRow;
        activeRow.addClass("active");

        // Just unchecked
        if (!checkbox.prop("checked")) {
            eventObj.uglify(messageViewerManager.activeScheme);
            regexMatcher.codeEvent(eventObj, messageViewerManager.activeScheme);
            checkbox.prop("checked", false);

            // only redraw the current row
            // leave row in place, as it was assigned a new code which the user doesn't know beforehand
            // they can then either confirm the automatic assignment via checkbox again
            // or re-sort to see the message move to its proper place in sorting (make an extra round through the sortings)
            messageViewerManager.updateRowHtml(messageRow, messageViewerManager.activeScheme);

            // update the activity stack
            storage.saveActivity({
                "category": "CODING",
                "message": "Used checkbox to unassign manual coding",
                "messageDetails": {"event": eventObj, "code": codeObj},
                "data": eventObj,
                "timestamp": new Date()
            });

        } else {
            // DON'T ALLOW "confirming" an empty coding!
            let deco = eventObj.decorations.get(messageViewerManager.activeScheme);
            if (deco && deco.code) {
                deco.manual = true;
                deco.confidence = 0.95;

                checkbox.prop("checked", true);

                // update the activity stack
                storage.saveActivity({
                    "category": "CODING",
                    "message": "Used checkbox to confirm automatic coding",
                    "messageDetails": {"event": eventObj, "scheme": messageViewerManager.activeScheme},
                    "data": eventObj,
                    "timestamp": new Date()
                });
            }

            let nextMessageRowIndex = newDataset.eventOrder.indexOf(eventObj.name) + 1;
            if (nextMessageRowIndex >= newDataset.eventOrder.length) {
                nextMessageRowIndex = newDataset.eventOrder.length - 1;
            }

            let nextEventId = newDataset.eventOrder[nextMessageRowIndex];

            if (messageViewerManager.currentSort !== messageViewerManager.sortUtils.restoreDefaultSort) {

                if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
                    newDataset.sortEventsByConfidenceOnly(messageViewerManager.activeScheme);
                }
                if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByScheme) {
                    newDataset.sortEventsByScheme(messageViewerManager.activeScheme, true);
                }

                undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

                let offset = activeRow.offset();

                // redraw body, PRESERVE ACTIVE ROW
                setTimeout(() => {
                    messageViewerManager.messageTable.find("tbody").empty();
                    messageViewerManager.decorationTable.find("tbody").empty();
                    let newMessageRow = messageViewerManager.bringEventIntoView2(nextEventId);

                    if (offset.top < messageViewerManager.messageContainer.height() && offset.top > messageViewerManager.messageTable.find("thead").height()) {
                        messageViewerManager.messageContainer.scrollTop(messageViewerManager.messageContainer.scrollTop() + (offset.top - newMessageRow.offset().top));
                    }
                }, 350);
            }
        }
    },

    addNewSchemeColumn: function(newScheme) {
        messageViewerManager.codeSchemeOrder.push(newScheme.id);

        regexMatcher.codeDataset(newScheme["id"]);
        if (messageViewerManager.codeSchemeOrder.length === 1) {
            // means the default scheme is being added
            // need to append to message table, not decorations table since it's becoming active scheme
            // also handle hiding decoration table and expanding the message table to full width
            let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
            let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");

            /*
            hide decoration table, expand message table to full width
             */
            decoTableTbodyElement.empty();
            decoTableTbodyElement.hide();
            messageTableTbodyElement.css({"width": "100%"});

            messageViewerManager.addNewActiveScheme(newScheme["id"]);

        } else {

            /*
            Rebuild the message table body + decorations table body
             */

            messageViewerManager.messageTable.css({"width": messageViewerManager.initialMessageTableWidth + ""});
            messageViewerManager.decorationTable.show();

            let messageTableTbody = "";
            let decoTableTbody = "";

            for (let i = 0; i < messageViewerManager.rowsInTable; i++) {
                let eventKey = newDataset.eventOrder[i];
                messageTableTbody += messageViewerManager.buildMessageTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                decoTableTbody += messageViewerManager.buildDecorationTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.codeSchemeOrder.slice(1));
            }

            let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
            let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");
            messageTableTbodyElement.empty();
            decoTableTbodyElement.empty();

            let messageRows = $(messageTableTbody).appendTo(messageTableTbodyElement);
            let decoRows = $(decoTableTbody).appendTo(decoTableTbodyElement);
            for (let i = 0; i < messageRows.length; i++) {
                // need to adjust heights so rows match in each table
                let outerHeight = $(messageRows[i]).outerHeight();
                $(decoRows[i]).outerHeight(outerHeight);
            }

            this.messageContainer.scrollTop(0);

            // Move active row back to top because nothing will have been coded yet
            activeRow.removeClass("active");
            activeRow = messageTableTbodyElement.find(".message-row").first().addClass("active");

            this.lastLoadedPageIndex = 1;

            /*
            Rebuild decorations table header
             */
            let decorationCell = messageViewerManager.decorationTable.find("thead").find("tr");
            decorationCell.empty();

            let allSchemeHeaders = messageViewerManager
                .buildDecorationsHeader(messageViewerManager.codeSchemeOrder.slice(1), "icon-def", decorationCell)
                .appendTo(decorationCell);

            /*
            let activeSchemeHeaderToAppend = this.buildSchemeHeaderElement(scheme["id"], "icon-def", true);
            let appendedActiveSchemeHeader = $(activeSchemeHeaderToAppend).appendTo(activeSchemeHeader);
            */

            $(allSchemeHeaders).find("i.scheme-name").on("click", event => {
                let schemeHeaderContainer = $(event.target).parents(".scheme-header"); // coding scheme header - container for buttons and name of particular scheme
                let schemeId = schemeHeaderContainer.attr("scheme");
                setTimeout(() => {
                    messageViewerManager.changeActiveScheme(schemeId);
                    messageViewerManager.resizeViewport();
                }, 500);
            });

            $(allSchemeHeaders).each((i, col) => {
                let column = $(col);
                let schemeKey = column.attr("scheme");
                let button = column.find(".edit-scheme-button");

                messageViewerManager.bindEditSchemeButtonListener(button, newDataset["schemes"][schemeKey]);
            });

            // Switch the active scheme to be the new one.
            messageViewerManager.changeActiveScheme(newScheme.id);

            let sortButton = $(".sort-btn");
            sortButton.off("click");
            sortButton.on("click", messageViewerManager.sortHandler);

            // init tooltips
            sortButton.tooltip();
            $(".edit-scheme-button").tooltip();

            messageViewerManager.resizeViewport();

            /*
            if ($(".scheme-header:first").outerWidth() <= 170 && Object.keys(newDataset.schemes).length > 4) {
                let outerContainer = $("#message-viewer");
                let current = outerContainer.outerWidth();
                outerContainer.outerWidth(current + 360);
            }
            */
        }
    },

    deleteSchemeColumn: function(schemeId) {

        let allNewHeaders;

        let activeSchemeInHtml = $("#active-scheme-header").find(".scheme-header").attr("scheme");
        let decorationsHeader = messageViewerManager.decorationTable.find("thead").find("tr");
        if (schemeId === activeSchemeInHtml) {
            // change active scheme plus redraw decorations table with header
            messageViewerManager.promoteToActiveScheme(messageViewerManager.codeSchemeOrder[0]);
            allNewHeaders = messageViewerManager.buildDecorationsHeader(messageViewerManager.codeSchemeOrder.slice(1), "icon-def", decorationsHeader);
        } else {
            // just redraw the decorations table with header
            allNewHeaders = messageViewerManager.buildDecorationsHeader(messageViewerManager.codeSchemeOrder.slice(1), "icon-def", decorationsHeader);
        }

        decorationsHeader.empty();
        decorationsHeader.append(allNewHeaders);

        // init tooltips
        let sortButton = $(".sort-btn");
        sortButton.tooltip();
        $(".edit-scheme-button").tooltip();

        if (allNewHeaders && allNewHeaders.length > 0) {
            // set up all listeners for header again
            $("#decorations-header").find("i.scheme-name").on("click", event => {
                let schemeHeaderContainer = $(event.target).parents(".scheme-header"); // coding scheme header - container for buttons and name of particular scheme
                let schemeId = schemeHeaderContainer.attr("scheme");
                setTimeout(() => {
                    messageViewerManager.changeActiveScheme(schemeId);
                    messageViewerManager.resizeViewport();
                }, 500);
            });

            $("#decorations-header").find(".scheme-header").each((i, col) => {
                let column = $(col);
                let schemeKey = column.attr("scheme");
                let button = column.find(".edit-scheme-button");

                messageViewerManager.bindEditSchemeButtonListener(button, newDataset["schemes"][schemeKey]);
            });

            sortButton.off("click");
            sortButton.on("click", messageViewerManager.sortHandler);
        }

        let messageTableTbody = "";
        let decoTableTbody = "";
        for (let i = 0; i < messageViewerManager.rowsInTable; i++) {
            let eventKey = newDataset.eventOrder[i];
            let eventObj = newDataset.events.get(eventKey);
            messageTableTbody += messageViewerManager.buildMessageTableRow(eventObj, i, eventObj.owner, messageViewerManager.codeSchemeOrder[0]);
            decoTableTbody += messageViewerManager.buildDecorationTableRow(eventObj, i, eventObj.owner, messageViewerManager.codeSchemeOrder.slice(1));
        }

        this.lastLoadedPageIndex = 1;

        let messageTbodyObj = this.messageTable.find("tbody");
        let decoTbodyObj = this.decorationTable.find("tbody");

        messageTbodyObj.empty();
        decoTbodyObj.empty();

        let activeMessageRows = $(messageTableTbody).appendTo(messageTbodyObj);
        if (decoTableTbody.length > 0) {
            let decoRows = $(decoTableTbody).appendTo(decoTbodyObj);
            for (let i = 0; i < activeMessageRows.length; i++) {
                // need to adjust heights so rows match in each table
                let outerHeight = $(activeMessageRows[i]).outerHeight();
                $(decoRows[i]).outerHeight(outerHeight);
            }
        } else {
            // if only one scheme (= the active one), hide deco table and expand the message one
            messageViewerManager.decorationTable.hide();
            messageViewerManager.messageTable.css({"width": "100%"});
        }

        this.messageContainer.scrollTop(0);

        activeRow.removeClass("active");
        activeRow = $(".message-row").first().addClass("active");

        scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
        scrollbarManager.redrawThumb(0);

        messageViewerManager.resizeViewport();

        return this.activeScheme;
    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");
        var schemeId = scheme.id;
        $(editButton).off("click");
        $(editButton).on("click", function(event) {

            let button = event.target;
            //let schemeId = $(this).parent().attr("scheme");
            scheme = newDataset.schemes[schemeId];
            tempScheme = CodeScheme.clone(scheme);
            let header = $(button).parents(".scheme-header");

            if (!(codeEditor.is(":visible"))) {

                let selectedOptionId = activeRow.find("option[selected]");

                editorOpen = true;
                let values = Array.from(tempScheme.codes.values()); // todo rewrite to use iterator
                values.forEach(function(codeObj) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], codeObj["id"], codeObj["words"]);
                });

                codeEditorManager.bindSaveEditListener(header);

                $("#scheme-name-input").val(scheme["name"]);

                codeEditor.show();

                // need to update code panel after editor is displayed so that the width is set correctly!
                codeEditorManager.updateCodePanel(values[values.length - 1]);

                // update the activity stack
                storage.saveActivity({
                    "category": "SCHEME",
                    "message": "Editing existing scheme",
                    "messageDetails": {"scheme": scheme.id},
                    "data": scheme.toJSON(),
                    "timestamp": new Date()
                });
            }
        });
    },

    manageShortcuts: function(event) {
        if (!editorOpen && messageViewerManager.activeScheme && activeRow && messageViewerManager.activeScheme.length > 0 && activeRow.length) {

            var shortcuts = newDataset.schemes[messageViewerManager.activeScheme].getShortcuts();
            if (shortcuts.has(event.keyCode)) {
                var codeObj = shortcuts.get(event.keyCode);
                var eventId = $(activeRow).attr("eventid");
                $(activeRow).children("td").each(function(i, td) {
                    newDataset.events.get(eventId).decorate(codeObj.owner["id"], true, UUID, codeObj, 0.95);
                    var color = codeObj["color"];

                    if ($(td).hasClass("message-text")) {
                        if (color && color.length !== 0 && color !== "#ffffff") {
                            $(td).css("box-shadow", "inset 0px 0px 0px 4px " + color);
                        } else {
                            $(td).css("box-shadow", "");
                        }

                    } else {
                        if (color && color.length !== 0) {
                            $(td).css("background-color", color);
                        } else {
                            $(td).css("background-color", "#ffffff");
                        }
                    }
                });

                $(activeRow).removeClass("uncoded");
                $(activeRow).addClass("coded");

                // set dropdown value
                $(activeRow).find("select").val(codeObj["value"]).removeClass("uncoded").addClass("coded");

                // check checkbox
                let decoColumn = activeRow.find(".checkbox-manual").prop("checked", true);

                if (messageViewerManager.horizontal) {
                    /*
          setTimeout(() => {
          messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
          }, 500);
          */
                    messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
                } else {
                    setTimeout(() => {
                        messageViewerManager.verticalCoding(eventId);
                    }, 200);
                }

                // update the activity stack
                storage.saveActivity({
                    "category": "CODING",
                    "message": "Used shortcut from scheme",
                    "messageDetails": {"shortcut": event.keyCode, "scheme": messageViewerManager.activeScheme},
                    "data": newDataset.events.get(eventId),
                    "timestamp": new Date()
                });
            }
        }
    },

    verticalCoding: function(eventId) {
        /*
        get new active row, keeping the active scheme
        N.B. will wrap if no uncoded events are found between eventId and end of list
        */
        let currentRow = $("#" + eventId);
        let nextEventId;
        let nextEventRow = null;
        let currentEventIndex = newDataset.eventOrder.indexOf(eventId);
        if (currentEventIndex + 1 < newDataset.eventOrder.length) {
            for (let i = currentEventIndex + 1; i < newDataset.eventOrder.length; i++) {
                let eventObj = newDataset.events.get(newDataset.eventOrder[i]);
                let deco = eventObj.decorations.get(messageViewerManager.activeScheme);
                if (!deco || !deco.code) {
                    nextEventId = eventObj.name;
                    break;
                }
            }
        }

        if (!nextEventId) {
            for (let i = 0; i < currentEventIndex + 1; i++) {
                let eventObj = newDataset.events.get(newDataset.eventOrder[i]);
                let deco = eventObj.decorations.get(messageViewerManager.activeScheme);
                if (!deco || !deco.code) {
                    nextEventId = eventObj.name;
                    break;
                }
            }
        }

        if (nextEventId) {
            nextEventRow = messageViewerManager.bringEventIntoView(nextEventId);
        } else {
            nextEventRow = messageViewerManager.bringEventIntoView(newDataset.events.get(newDataset.eventOrder[currentEventIndex + 1]));
        }

        return nextEventRow;
    },

    horizontalCoding: function(eventId) {

        // switch to next active scheme: next uncoded column
        let eventObj = newDataset.events.get(eventId);
        let nextScheme = eventObj.firstUncodedScheme(messageViewerManager.codeSchemeOrder);
        if (nextScheme.length > 0) {
            // pass the columns until reaching this scheme
            setTimeout(() => {
                let immutableSchemeOrder = messageViewerManager.codeSchemeOrder.slice();
                for (let schemeKey of immutableSchemeOrder) {
                    if (schemeKey === nextScheme) {
                        break;
                    } else {
                        messageViewerManager.changeActiveScheme();
                        messageViewerManager.resizeViewport();
                    }
                }
            }, 750);

        } else {
            // go to next uncoded event

            setTimeout(() => {

                let nextEventIndex = newDataset.eventOrder.indexOf(eventId);
                let uncodedScheme = "";
                while (uncodedScheme.length === 0 && nextEventIndex < newDataset.eventOrder.length) {
                    nextEventIndex++;
                    let nextEventObj = newDataset.events.get(newDataset.eventOrder[nextEventIndex]);
                    uncodedScheme = nextEventObj.firstUncodedScheme(messageViewerManager.codeSchemeOrder);
                    console.log(uncodedScheme);
                }

                if (uncodedScheme.length !== 0) {
                    //change active row & active scheme to first scheme
                    let newActiveEvent = newDataset.events.get(newDataset.eventOrder[nextEventIndex]);
                    let eventRow = messageViewerManager.bringEventIntoView(newActiveEvent.name);

                    if (eventRow && eventRow.length > 0) {
                        // change active scheme!
                        let immutableCodeSchemeOrder = messageViewerManager.codeSchemeOrder.slice();
                        for (let scheme of immutableCodeSchemeOrder) {
                            if (scheme === uncodedScheme) {
                                break;
                            } else {
                                messageViewerManager.changeActiveScheme();
                                messageViewerManager.resizeViewport();
                            }
                        }
                    } else {
                        // something went wrong with bringing event in
                        console.log("WARNING: Event with id " + eventId + " not found in table");
                    }

                } else {
                    // everything from here is coded
                    console.log("NO EVENT UNCODED");
                }

            }, 250);
        }

        // active row element is stale since tbody has been redrawn, so need to get the new copy
        let activeRowId = activeRow.attr("id");
        activeRow = $("#" + activeRowId);
        activeRow.find("select." + messageViewerManager.activeScheme).focus();
    },

    bringEventIntoView: function(eventId) {
        let eventRow = $(".message-row[eventid='" + eventId + "']");
        let eventIndex = newDataset.eventOrder.indexOf(eventId);
        activeRow.removeClass("active");

        if (!eventRow || eventRow.length === 0) {
            // this event is not loaded in the table
            // 1. find out what page of events it's in
            // 2. load the appropriate pair of pages in

            let pageIndex = Math.floor(eventIndex / Math.floor(messageViewerManager.rowsInTable / 2));

            // load in pages at index pageIndex & pageIndex-1 except if pageIndex-1 is out of range!
            let tbody = "";
            if (pageIndex === 0) {
                // load 0th and 1st
                tbody += messageViewerManager.createPageHTML(0);
                tbody += messageViewerManager.createPageHTML(1);
                messageViewerManager.lastLoadedPageIndex = 1;

            } else {
                tbody += messageViewerManager.createPageHTML(pageIndex - 1);
                tbody += messageViewerManager.createPageHTML(pageIndex);
                messageViewerManager.lastLoadedPageIndex = pageIndex;

            }

            let currentTbody = messageViewerManager.messageTable.find("tbody");
            currentTbody.empty();
            currentTbody.append(tbody);

            eventRow = $(".message-row[eventid='" + eventId + "']");

            if (eventRow) {
                eventRow.addClass("active");
                activeRow = eventRow;

                if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messageContainer[0])) {
                    messageViewerManager.isProgramaticallyScrolling = true;
                    UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messageContainer[0]);
                    messageViewerManager.isProgramaticallyScrolling = false;
                }

                scrollbarManager.redrawThumbAtEvent(eventIndex);

            }

        } else {
            eventRow.addClass("active");
            activeRow = eventRow;

            if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messageContainer[0])) {
                UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messageContainer[0]);
            }
            scrollbarManager.redrawThumbAtEvent(eventIndex);
        }

        let selectField = eventRow.find("select." + messageViewerManager.activeScheme);
        selectField.focus();
        return eventRow;
    },

    bringEventIntoView2: function(eventId) {
        let eventRow = $(".message-row[eventid='" + eventId + "']");
        let eventIndex = newDataset.eventOrder.indexOf(eventId);
        activeRow.removeClass("active");

        if (!eventRow || eventRow.length === 0) {
            // this event is not loaded in the table
            // 1. find out what page of events it's in
            // 2. load the appropriate pair of pages in

            let pageIndex = Math.floor(eventIndex / Math.floor(messageViewerManager.rowsInTable / 2));

            // load in pages at index pageIndex & pageIndex-1 except if pageIndex-1 is out of range!
            let messageTableTbody = "";
            let decoTableTbody = "";
            if (pageIndex === 0 || pageIndex === -1) {
                // load 0th and 1st
                // also cover the broken case of no index found
                messageTableTbody += messageViewerManager.createMessagePageHTML(0);
                messageTableTbody += messageViewerManager.createMessagePageHTML(1);

                decoTableTbody += messageViewerManager.createDecorationPageHTML(0);
                decoTableTbody += messageViewerManager.createDecorationPageHTML(1);

                messageViewerManager.lastLoadedPageIndex = 1;

            } else if (pageIndex > 0) {
                messageTableTbody += messageViewerManager.createMessagePageHTML(pageIndex - 1);
                messageTableTbody += messageViewerManager.createMessagePageHTML(pageIndex);

                decoTableTbody += messageViewerManager.createDecorationPageHTML(pageIndex - 1);
                decoTableTbody += messageViewerManager.createDecorationPageHTML(pageIndex);

                messageViewerManager.lastLoadedPageIndex = pageIndex;

            }

            let currentMessageTbody = messageViewerManager.messageTable.find("tbody");
            let currentDecoTbody = messageViewerManager.decorationTable.find("tbody");
            currentMessageTbody.empty();
            let messageRows = $(messageTableTbody).appendTo(currentMessageTbody);
            currentDecoTbody.empty();
            let decoRows = $(decoTableTbody).appendTo(currentDecoTbody);

            for (let i = 0; i < messageRows.length; i++) {
                // need to adjust heights so rows match in each table
                let outerHeight = $(messageRows[i]).outerHeight();
                $(decoRows[i]).outerHeight(outerHeight);
            }

            eventRow = $(".message-row[eventid='" + eventId + "']");

            if (eventRow) {
                eventRow.addClass("active");
                activeRow = eventRow;

                if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messageContainer[0])) {
                    messageViewerManager.isProgramaticallyScrolling = true;
                    UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messageContainer[0]);
                    messageViewerManager.isProgramaticallyScrolling = false;
                }

                scrollbarManager.redrawThumbAtEvent(eventIndex);

            }

        } else {
            eventRow.addClass("active");
            activeRow = eventRow;

            if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messageContainer[0])) {
                UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messageContainer[0]);
            }
            scrollbarManager.redrawThumbAtEvent(eventIndex);
        }

        let selectField = eventRow.find("select." + messageViewerManager.activeScheme);
        selectField.focus();
        return eventRow;
    },

    infiniteScroll: function(event) {

        // todo: fix bug with scrolling to the bottom!!!!!!!! :o :o :o :o :o :o

        let currentY = messageViewerManager.messageContainer.scrollTop();
        if (currentY === messageViewerManager.lastTableY || messageViewerManager.isProgramaticallyScrolling) {
            return;
        }

        if (currentY > messageViewerManager.lastTableY && UIUtils.isScrolledToBottom(messageViewerManager.messageContainer)) {
            console.time("infinite scroll DOWN");

            let nextPage = messageViewerManager.lastLoadedPageIndex + 1;

            if (nextPage <= Math.floor(newDataset.eventOrder.length / Math.floor(messageViewerManager.rowsInTable / 2)) - 1) {

                messageViewerManager.lastLoadedPageIndex = nextPage;

                let messageTableTbody = "";
                let decoTableTbody = "";

                let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
                let stoppingCondition = nextPage * halfPage + halfPage > newDataset.eventOrder.length ? newDataset.eventOrder.length : nextPage * halfPage + halfPage;
                for (let i = nextPage * halfPage; i < stoppingCondition; i++) {
                    let eventKey = newDataset.eventOrder[i];
                    messageTableTbody += messageViewerManager.buildMessageTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                    decoTableTbody += messageViewerManager.buildDecorationTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.codeSchemeOrder.slice(1));
                }

                let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
                let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");

                let lastMessage = messageTableTbodyElement.find(".message-row").last();
                let lastMessagePosition = lastMessage.position().top;

                let elementsToRemoveFromMessageTable = messageTableTbodyElement.find("tr:nth-child(-n+" + Math.floor(messageViewerManager.rowsInTable / 2) + ")");
                let elementsToRemoveFromDecoTable = decoTableTbodyElement.find("tr:nth-child(-n+" + Math.floor(messageViewerManager.rowsInTable / 2) + ")");

                elementsToRemoveFromMessageTable.remove();
                elementsToRemoveFromDecoTable.remove();

                let messageRows = $(messageTableTbody).appendTo(messageTableTbodyElement);
                let decoRows = $(decoTableTbody).appendTo(decoTableTbodyElement);

                for (let i = 0; i < messageRows.length; i++) {
                    // need to adjust heights so rows match in each table
                    let outerHeight = $(messageRows[i]).outerHeight();
                    $(decoRows[i]).outerHeight(outerHeight);
                }

                console.log("new page added");

                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.messageContainer.scrollTop($("#message-panel").scrollTop() + (-1 * (lastMessagePosition - lastMessage.position().top)));
                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
                messageViewerManager.isProgramaticallyScrolling = false;
                //scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);

                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redrawThumb(thumbPos);

                console.timeEnd("infinite scroll DOWN");

            } else if ($(".message-row").length <= 40 && nextPage === Math.floor(newDataset.eventOrder.length / Math.floor(messageViewerManager.rowsInTable / 2))) {
                let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);

                let messageTableTbody = "";
                let decoTableTbody = "";
                for (let i = 0; i < (newDataset.eventOrder.length - (nextPage * halfPage)); i++) {
                    let eventKey = newDataset.eventOrder[(nextPage - 1) * halfPage + halfPage + i];
                    if (eventKey) {
                        messageTableTbody += messageViewerManager.buildMessageTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                        decoTableTbody += messageViewerManager.buildDecorationTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.codeSchemeOrder.slice(1));
                    }
                }

                let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
                let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");

                let lastMessage = messageTableTbodyElement.find(".message-row").last();
                let lastMessagePosition = lastMessage.position().top;

                let messageRows = $(messageTableTbody).appendTo(messageTableTbodyElement);
                let decoRows = $(decoTableTbody).appendTo(decoTableTbodyElement);

                for (let i = 0; i < messageRows.length; i++) {
                    // need to adjust heights so rows match in each table
                    let outerHeight = $(messageRows[i]).outerHeight();
                    $(decoRows[i]).outerHeight(outerHeight);
                }

                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.messageContainer.scrollTop($("#message-panel").scrollTop() + (-1 * (lastMessagePosition - lastMessage.position().top)));
                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
                messageViewerManager.isProgramaticallyScrolling = false;

                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redrawThumb(thumbPos);
            }

        } else if (currentY < messageViewerManager.lastTableY && UIUtils.isScrolledToTop(messageViewerManager.messageContainer)) {

            if (messageViewerManager.lastLoadedPageIndex !== 1) {
                console.time("infinite scroll UP");

                let prevPage = messageViewerManager.lastLoadedPageIndex - 2;
                messageViewerManager.lastLoadedPageIndex--;
                let firstRow = $(".message-row").first();
                let originalOffset = firstRow.position().top;

                let messageTableTbody = "";
                let decoTableTbody = "";

                let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
                let stoppingCondition = prevPage * halfPage + halfPage;
                for (let i = prevPage * halfPage; i < stoppingCondition; i++) {
                    let eventKey = newDataset.eventOrder[i];
                    messageTableTbody += messageViewerManager.buildMessageTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                    decoTableTbody += messageViewerManager.buildDecorationTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.codeSchemeOrder.slice(1));
                }

                let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
                let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");
                messageTableTbodyElement.find("tr:nth-last-child(-n+" + Math.floor(messageViewerManager.rowsInTable) / 2 + ")").remove();
                decoTableTbodyElement.find("tr:nth-last-child(-n+" + Math.floor(messageViewerManager.rowsInTable) / 2 + ")").remove();

                let messageRows = $(messageTableTbody).prependTo(messageTableTbodyElement);
                let decoRows = $(decoTableTbody).prependTo(decoTableTbodyElement);

                for (let i = 0; i < messageRows.length; i++) {
                    // need to adjust heights so rows match in each table
                    let outerHeight = $(messageRows[i]).outerHeight();
                    $(decoRows[i]).outerHeight(outerHeight);
                }

                // adjust scrollTop of the panel so that the previous top row stays on top of the table (and not out of view)
                let newOffset = firstRow.position().top;
                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.messageContainer.scrollTop(messageViewerManager.messageContainer.scrollTop() + (-1 * (originalOffset - newOffset)));
                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
                messageViewerManager.isProgramaticallyScrolling = false;

                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redrawThumb(thumbPos);
                console.timeEnd("infinite scroll UP");

            }
        }
    },

    createPageHTML: function(index) {

        var tbody = "";

        const halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (index * halfPage + halfPage > newDataset.eventOrder.length) ? newDataset.eventOrder.length : index * halfPage + halfPage;

        for (let i = index * halfPage; i < stoppingCondition; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner);
        }

        return tbody;
    },

    createMessagePageHTML: function(index) {

        var tbody = "";

        const halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (index * halfPage + halfPage > newDataset.eventOrder.length) ? newDataset.eventOrder.length : index * halfPage + halfPage;

        for (let i = index * halfPage; i < stoppingCondition; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildMessageTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
        }

        return tbody;
    },

    createDecorationPageHTML: function(index) {

        var tbody = "";

        const halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (index * halfPage + halfPage > newDataset.eventOrder.length) ? newDataset.eventOrder.length : index * halfPage + halfPage;

        for (let i = index * halfPage; i < stoppingCondition; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildDecorationTableRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.codeSchemeOrder.slice(1));
        }

        return tbody;
    },

    buildRow: function(eventObj, eventIndex, sessionIndex) {

        var decoNumber = Object.keys(newDataset.schemes).length;
        var decoColumnWidth = (12 / decoNumber >> 0);
        var sessionRow = "";

        if (!eventObj) {
            console.log("undefined");
        }

        var activeDecoration = eventObj["decorations"].get(messageViewerManager.activeScheme);
        var rowColor = "#ffffff";
        var eventText = eventObj["data"];

        // need to check if eventObj has a 'stale' decoration
        // need to perform null checks for code! if event isn't coded yet it has a null code.
        if (activeDecoration !== undefined && activeDecoration.code !== null) {

            var parentSchemeCodes = activeDecoration.code.owner instanceof CodeScheme ? activeDecoration.code.owner.codes : newDataset.schemes[activeDecoration.code.owner].codes;
            if (!parentSchemeCodes.has(activeDecoration.code.id)) {
                // in case the event object is still coded with a code that doesn't exist in the scheme anymore
                eventObj.uglify(activeDecoration.scheme_id);

            } else if (activeDecoration.code.color !== undefined && activeDecoration.code.color.length !== 0) {
                rowColor = activeDecoration.code.color;
            }

            if (activeDecoration.code.regex && activeDecoration.code.regex.length === 2 && activeDecoration.code.regex[0].length > 0) {
                try { //todo fix inefficiency in rebuilding regexes for each row
                    let customRegex = new RegExp(activeDecoration.code.regex[0], activeDecoration.code.regex[1].indexOf("g") > -1 ? activeDecoration.code.regex[1] : activeDecoration.code.regex[1] + "g");
                    eventText = regexMatcher.wrapText(eventObj["data"], customRegex, "highlight", activeDecoration.code.id);
                } catch (e) {
                    console.log(e);
                    eventText = eventObj["data"];
                }

            } else {
                eventText = regexMatcher.wrapText(eventObj["data"], regexMatcher.generateOrRegex(activeDecoration.code.words), "highlight", activeDecoration.code.id);
            }

        }

        let shadowStyle = (rowColor === "#ffffff") ? "" : " style='box-shadow: inset 0px 0px 0px 4px " + rowColor + "'";

        sessionRow += "<tr class='message-row' id=" + eventObj["name"] + " eventid = '" + eventObj["name"] + "' eventindex = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";
        sessionRow += "<td class='col-md-1 message-id' style='background-color: " + rowColor + "'>" + eventObj["name"] + "</td>";
        sessionRow += "<td class='col-md-7 message-text'" + shadowStyle + "><p>" + eventText + "</p></td>";
        sessionRow += "<td class='col-md-4 decorations' style='background-color: " + rowColor + "'>";

        sessionRow += UIUtils.decoRowColumn(Object.keys(newDataset.schemes).length, newDataset.schemes, eventObj);
        sessionRow += "</td>";
        sessionRow += "</td>";
        sessionRow += "</tr>";

        return sessionRow;
    },

    buildDecorationTableRow: function(eventObj, eventIndex, sessionIndex, remainingOrderedSchemes) {

        if (!eventObj) {
            console.log("undefined");
            return "";
        }

        if (remainingOrderedSchemes.length === 0) {
            return "";
        }

        function divideRowInColumns(schemeNumber, orderedSchemes, eventObj) {

            let rowColumnNumberClass = "";
            let cellColumnNumberClass = "";
            let eventRow = "";
            if (schemeNumber >= 1 && 12 >= schemeNumber) {
                switch (schemeNumber) {
                    case(5):
                        rowColumnNumberClass = "five-cols";
                        cellColumnNumberClass = 1;
                        break;
                    case(7):
                        rowColumnNumberClass = "seven-cols";
                        cellColumnNumberClass = 1;
                        break;
                    case(8):
                        rowColumnNumberClass = "eight-cols";
                        cellColumnNumberClass = 1;
                        break;
                    case(9):
                        rowColumnNumberClass = "nine-cols";
                        cellColumnNumberClass = 1;
                        break;
                    case(10):
                        rowColumnNumberClass = "nine-cols";
                        cellColumnNumberClass = 1;
                        break;
                    case(11):
                        rowColumnNumberClass = "eleven-cols";
                        cellColumnNumberClass = 1;
                        break;
                    default:
                        rowColumnNumberClass = "";
                        cellColumnNumberClass = 12 / schemeNumber >> 0;
                }

                eventRow += "<tr class='deco-row row " + rowColumnNumberClass + "' id='message-deco-" + eventObj["name"] + "' eventid = '" + eventObj["name"] + "' eventindex = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";

                orderedSchemes.forEach(schemeKey => {

                    eventRow += "<td class='col-md-" + cellColumnNumberClass + " col-sm-" + cellColumnNumberClass + " col-xs-" + cellColumnNumberClass + " deco-container' scheme='" + schemeKey + "'>";

                    eventRow += "<div class='input-group'>";
                    let dis = "disabled";
                    if (eventObj.decorations.get(schemeKey) && eventObj.decorations.get(schemeKey).manual) {
                        eventRow += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' checked " + dis + "></span>";
                    } else {
                        eventRow += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' " + dis + "></span>";
                    }
                    eventRow += messageViewerManager.buildCodeSelectField(newDataset.schemes[schemeKey], eventObj, false);
                    eventRow += "</div>";

                    eventRow += "</td>";
                });

                return eventRow + "</tr>";

            } else if (schemeNumber > 12) {
                eventRow = "<tr class='deco-row row' id='message-deco-" + eventObj["name"] + "' eventid = '" + eventObj["name"] + "' eventindex = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";
                let decoCol1 = "<div class='col-md-6 col-sm-6 col-lg-6 col-xs-6'>" + divideRowInColumns(schemeNumber / 2 >> 0, orderedSchemes, eventObj) + "</div>";
                let decoCol2 = "<div class='col-md-6 col-sm-6 col-lg-6 col-xs-6'>" + divideRowInColumns((schemeNumber / 2 >> 0) + schemeNumber % 2, orderedSchemes, eventObj) + "</div>";
                return eventRow + decoCol1 + decoCol2 + "</tr>";
            }

        }

        let eventRow = divideRowInColumns(remainingOrderedSchemes.length, remainingOrderedSchemes, eventObj);

        return eventRow;
    },

    buildMessageTableRow: function(eventObj, eventIndex, sessionId, activeSchemeKey) {

        if (!eventObj) {
            console.log("undefined");
            return;
        }

        let schemeObj = newDataset.schemes[activeSchemeKey];
        let eventText = eventObj["data"];
        let activeDecoration = eventObj["decorations"].get(activeSchemeKey);

        let eventRow = "";
        let rowColor = "#ffffff";

        // need to check if eventObj has a 'stale' decoration
        // need to perform null checks for code! if event isn't coded yet it has a null code.
        if (activeDecoration && activeDecoration.code) {
            let parentSchemeCodes = activeDecoration.code.owner instanceof CodeScheme ? activeDecoration.code.owner.codes : newDataset.schemes[activeDecoration.code.owner].codes;

            if (!parentSchemeCodes.has(activeDecoration.code.id)) {
                // in case the event object is still coded with a code that doesn't exist in the scheme anymore
                eventObj.uglify(activeDecoration.scheme_id);

            } else if (activeDecoration.code.color !== undefined && activeDecoration.code.color.length !== 0) {
                rowColor = activeDecoration.code.color;
            }

            if (activeDecoration.code.regex && activeDecoration.code.regex.length === 2 && activeDecoration.code.regex[0].length > 0) {
                try {
                    // todo fix inefficiency in rebuilding regexes for each row
                    let customRegex = new RegExp(activeDecoration.code.regex[0], activeDecoration.code.regex[1].indexOf("g") > -1 ? activeDecoration.code.regex[1] : activeDecoration.code.regex[1] + "g");
                    eventText = regexMatcher.wrapText(eventObj["data"], customRegex, "highlight", activeDecoration.code.id);
                } catch (e) {
                    console.log(e);
                    eventText = eventObj["data"];
                }

            } else {
                eventText = regexMatcher.wrapText(eventObj["data"], regexMatcher.generateOrRegex(activeDecoration.code.words), "highlight", activeDecoration.code.id);
            }

        }

        let shadowStyle = (rowColor === "#ffffff") ? "" : " style='box-shadow: inset 0px 0px 0px 4px " + rowColor + "'"; // coloured shadow around message text

        eventRow += "<tr class='message-row row' id='message-" + eventObj["name"] + "' eventid = '" + eventObj["name"] + "' eventindex = '" + eventIndex + "' sessionId = '" + sessionId + "'>";
        eventRow += "<td class='col-md-1 message-id' style='background-color: " + rowColor + "'>" + eventObj["name"] + "</td>";
        eventRow += "<td class='col-md-7 message-text'" + shadowStyle + "><p>" + eventText + "</p></td>";

        eventRow += "<td class='col-md-4 active-scheme' style='background-color: " + rowColor + "'>";
        eventRow += "<div class='input-group' scheme='" + activeSchemeKey + "' >";

        if (eventObj.decorations.get(activeSchemeKey) && eventObj.decorations.get(activeSchemeKey).manual) {
            eventRow += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' checked></span>";
        } else {
            eventRow += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox'></span>";
        }

        eventRow += this.buildCodeSelectField(schemeObj, eventObj, true);

        eventRow += "</td>";

        eventRow += "</td>";
        eventRow += "</tr>";

        return eventRow;
    },

    buildCodeSelectField(schemeObj, eventObj, isActive) {

        if (typeof isActive === "undefined") isActive = false;

        let optionsString = "";
        let selectClass = "uncoded";
        let somethingSelected = false;
        let disabled = isActive ? "" : "disabled";

        for (let codeObj of schemeObj.codes.values()) {
            if (eventObj["decorations"].has(schemeObj.id)) {

                let currentEventCode = eventObj["decorations"].get(schemeObj.id).code;
                if (currentEventCode && currentEventCode["value"] === codeObj["value"]) {
                    optionsString += "<option codeid='" + codeObj["id"] + "' selected>" + codeObj["value"] + "</option>";
                    selectClass = "coded";
                    somethingSelected = true;
                } else {
                    optionsString += "<option codeid='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>";
                }

            } else {
                //eventObj.decorate(schemeObj.id);
                optionsString += "<option codeid='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>";
            }
        }

        let selectField = "<select class='form-control " + schemeObj.id + " " + selectClass + "'" + disabled + ">";

        selectField += optionsString;

        if (!somethingSelected) {
            selectField += "<option class='unassign' selected></option>";
        } else {
            selectField += "<option class='unassign'></option>";
        }

        selectField += "</select>";

        return selectField;
    },

    demoteFromActiveScheme(schemeKey, moveToBack) {
        // take active scheme containers, move them to the end of the decorations table

        if (typeof moveToBack === "undefined") moveToBack = true;

        let decorationsTableHeader = $("#decorations-header"); // container for all the coding scheme headers
        let currentActiveSchemeHeaderContainer = $("#active-scheme-header");
        currentActiveSchemeHeaderContainer.find("i.scheme-name").removeClass("active-scheme");

        // push current one to the end of the list
        let lastSchemeElement = decorationsTableHeader.find(".scheme-header").last();
        let otherDecoClassName = lastSchemeElement.attr("class");

        let demotedHeader = currentActiveSchemeHeaderContainer.find(".scheme-header").detach();
        demotedHeader.attr("class", otherDecoClassName);

        if (moveToBack) {
            lastSchemeElement.after(demotedHeader);
        } else {
            decorationsTableHeader.prepend(demotedHeader);
        }

        // pass message rows and move active cell to end of the decorations table
        $(".message-row").each((i, tr) => {

            let eventId = $(tr).attr("eventid");
            let activeSchemeCell = $(tr).find(".active-scheme");
            let demotedSchemeCell = $("<td scheme='" + schemeKey + "'></td>");

            let activeSchemeInputGroup = activeSchemeCell.find(".input-group").detach();
            activeSchemeInputGroup.find("select").attr("disabled", "");
            activeSchemeInputGroup.find(".checkbox-manual").attr("disabled", "");

            let className = messageViewerManager.decorationTable.find(".deco-container:first").attr("class");
            demotedSchemeCell.append(activeSchemeInputGroup);
            demotedSchemeCell.attr("class", className);

            // remove all color
            $(tr).find("td").css({"background-color": "", "box-shadow": ""});

            let decoRow = messageViewerManager.decorationTable.find(".deco-row[eventid='" + eventId + "']");
            if (moveToBack) {
                decoRow.append(demotedSchemeCell);
            } else {
                decoRow.prepend(demotedSchemeCell);
            }
        });

    },

    promoteToActiveScheme(schemeKey) {
        // all listeners will stay active if just detaching and appending elements

        schemeKey = schemeKey + ""; //coerce to string

        /*
        reattach active scheme header
         */
        let activeSchemeHeaderParent = $("#active-scheme-header");
        activeSchemeHeaderParent.empty();

        let newActiveHeader = $("#decorations-header").find(".scheme-header[scheme='" + schemeKey + "']").detach();
        newActiveHeader.find("i.scheme-name").addClass("active-scheme");
        activeSchemeHeaderParent.append(newActiveHeader);

        /*
        add new cells to activescheme column
         */
        let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
        messageTableTbodyElement.find(".message-row").each((i, messageRow) => {

            let eventObj = newDataset.events.get($(messageRow).attr("eventid"));

            let activeSchemeCell = $(messageRow).find(".active-scheme");
            let messageTextCell = $(messageRow).find(".message-text");
            let idCell = $(messageRow).find(".message-id");
            activeSchemeCell.empty();

            let eventDeco = eventObj.decorations.get(schemeKey);
            if (eventDeco && eventDeco.code) {
                let color = eventDeco.code["color"];
                activeSchemeCell.css({
                    // N.B. message text cells are recoloured in change active scheme
                    // this function only deals with the actual active scheme column
                    "background-color": (color && color.length !== 0 && color !== "#ffffff" ) ? color : ""
                });

                idCell.css({
                    "background-color": (color && color.length !== 0 && color !== "#ffffff" ) ? color : ""
                });

                messageTextCell.css({
                    "box-shadow": (color && color.length !== 0 && color !== "#ffffff" ) ? "inset 0px 0px 0px 4px " + color : ""
                });

                // remove all highlights
                regexMatcher.unwrapHighlights($(messageRow).find("p"));
                regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(eventDeco.code.words), eventDeco.code.id);
            }

            let decoRow = messageViewerManager.decorationTable.find(".deco-row[eventid='" + $(messageRow).attr("eventid") + "']");
            let decoContainer = decoRow.find(".deco-container[scheme='" + schemeKey + "']");
            let newActiveScheme = decoContainer.find(".input-group").detach();

            newActiveScheme.find("select").removeAttr("disabled");
            newActiveScheme.find(".checkbox-manual").removeAttr("disabled");

            decoContainer.remove();
            activeSchemeCell.append(newActiveScheme);
        });

    },

    addNewActiveScheme(schemeKey) {
        schemeKey = schemeKey + ""; //coerce to string

        /*
        build active scheme header
         */
        let activeSchemeHeaderParent = $("#active-scheme-header");
        activeSchemeHeaderParent.empty();

        let newHeader = $(messageViewerManager.buildSchemeHeaderElement(schemeKey, "icon-def", true))
            .appendTo(activeSchemeHeaderParent);

        // init listeners
        $(newHeader).find("i.scheme-name").on("click", event => {
            let schemeHeaderContainer = $(event.target).parents(".scheme-header"); // coding scheme header - container for buttons and name of particular scheme
            let schemeId = schemeHeaderContainer.attr("scheme");
            setTimeout(() => {
                messageViewerManager.changeActiveScheme(schemeId);
                messageViewerManager.resizeViewport();
            }, 500);
        });

        $(newHeader).each((i, col) => {
            let column = $(col);
            let button = column.find(".edit-scheme-button");

            messageViewerManager.bindEditSchemeButtonListener(button, newDataset["schemes"][schemeKey]);

        });

        let sortButton = $(".sort-btn");
        sortButton.off("click");
        sortButton.on("click", messageViewerManager.sortHandler);

        // init tooltips
        sortButton.tooltip();
        $(".edit-scheme-button").tooltip();

        /*
        add new cells to activescheme column
         */
        let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
        messageTableTbodyElement.find(".message-row").each((i, row) => {

            let eventObj = newDataset.events.get($(row).attr("eventid"));

            let activeSchemeTd = $(row).find(".active-scheme");
            let activeSchemeSelectFieldInputGroup = activeSchemeTd.find(".input-group");
            activeSchemeSelectFieldInputGroup.empty();

            let newCheckbox = "";

            regexMatcher.unwrapHighlights($(row).find("p"));
            let eventDeco = eventObj.decorations.get(schemeKey);
            if (eventDeco) {

                if (eventDeco.code) {
                    let color = eventDeco.code["color"];
                    activeSchemeTd.css({
                        "background-color": (color && color.length !== 0 && color !== "#ffffff" ) ? color : ""
                        // N.B. message text cells are recoloured in change active scheme
                        // this function only deals with the actual active scheme column
                    });

                    regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(eventDeco.code.words), eventDeco.code.id);
                }

                if (eventObj.decorations.get(schemeKey).manual) {
                    newCheckbox += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' checked></span>";
                } else {
                    newCheckbox += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox'></span>";
                }

            } else {
                newCheckbox += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox'></span>";
            }

            let newSelectField = messageViewerManager.buildCodeSelectField(newDataset.schemes[schemeKey], eventObj, true);

            activeSchemeSelectFieldInputGroup.append($(newCheckbox + newSelectField));

        });
    },

    collectWords: function(element) {

        if ($(element).prop("tagName") === "TD") {

            let highlightContext = $(element);
            var sessionId = $(element).closest("tr").attr("sessionid");
            var eventId = $(element).closest("tr").attr("eventid");

            if (window.getSelection && window.getSelection() && window.getSelection().toString().length > 0) {

                var selection = window.getSelection().toString(); // todo do we preprocess this in any way?
                console.log(selection);

                selection = selection.trim();
                if (selection.length === 0) {
                    return;
                }

                // check if current row has an assigned code and if yes, add the words to the data structure
                // todo FIX THIS - check in data structure

                const code = newDataset.events.get(eventId).codeForScheme(messageViewerManager.activeScheme);
                const isCoded = code != undefined;

                if (isCoded) {

                    code.addWords([selection]);
                    let regex = regexMatcher.generateOrRegex(code.words);

                    //$(".message-row[eventid='" + eventId + "']").find("p").html(regexMatcher.wrapText(newDataset.events.get(eventId).data, regex, "highlight", code.id));

                    regexMatcher.unwrapHighlights($(element).find("p"));
                    regexMatcher.wrapElement(newDataset.events.get(eventId), regex, code.id);
                    //schemes[messageViewerManager.activeScheme].getCodeByValue(selectElement.val()).words = words;

                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Highlighted string for code in scheme",
                        "messageDetails": {"word": selection, "scheme": code.owner.id, "code": code.id},
                        "data": code,
                        "timestamp": new Date()
                    });

                } else {
                    let regex = regexMatcher.generateOrRegex([selection]);
                    $(".message-row[eventid='" + eventId + "']").find("p").html(regexMatcher.wrapText(newDataset.events.get(eventId).data, regex, "highlight"));

                    if (messageViewerManager.wordBuffer[sessionId][eventId][selection] !== 1) {
                        messageViewerManager.wordBuffer[sessionId][eventId][selection] = 1;
                    }

                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Highlighted string",
                        "messageDetails": {"word": selection},
                        "data": [selection],
                        "timestamp": new Date()
                    });
                }
            }
        }
    },

    resizeViewport: function() {
        let containerObj = $("#message-viewer");
        let messagePanel = $("#message-panel");
        let tableCol = $("#table-col");
        let bootstrapTableColumnWidth = 10 / 12; // ratio for the column width of the main panel containing the two tables

        let leftOverSpace = messagePanel.width() - messageViewerManager.decorationTable.outerWidth() - messageViewerManager.messageTable.outerWidth();
        if (leftOverSpace > 20 && containerObj.outerWidth() >= 1230) {
            // leftover panel space
            if (window.outerWidth === containerObj.outerWidth()) {
                //messagePanel.outerWidth(messagePanel.outerWidth() - leftOverSpace);
                messagePanel.css("width", messagePanel.width() - leftOverSpace);
                // also need to shrink the column
                tableCol.outerWidth(tableCol.outerWidth() - leftOverSpace);
                containerObj.outerWidth(containerObj.outerWidth() - leftOverSpace);
                console.log("window.outer == container");

            } else if (window.outerWidth < containerObj.outerWidth()) {
                // container could be oversized from earlier so needs to shrink
                let newPanelWidth = messagePanel.width() - leftOverSpace;
                containerObj.width(Math.ceil(newPanelWidth / bootstrapTableColumnWidth));
                console.log("window.outer < container");

            } else {
                // viewport was shrunk earlier?
                console.log("AAA");
                messageViewerManager.decorationTable.css("width", "auto");
            }
        }

        if (Math.abs(messageViewerManager.messageTable.offset().top - messageViewerManager.decorationTable.offset().top) > 2) {
            // not enough space for both tables to fit next to each other - one is stuck below the other
            let totalWidthToAccommodate = messageViewerManager.messageTable.outerWidth() + messageViewerManager.decorationTable.outerWidth();

            let newContainerWidth = Math.ceil(totalWidthToAccommodate / bootstrapTableColumnWidth) + 30; // NB need to account for bootstrap column padding
            console.log("offset");

            containerObj.width(newContainerWidth);
            messagePanel.css("width", "");
            tableCol.css("width", "");
        }

        let headerWidths = new Map();
        let maxWidth = 0;
        let decoHeaders = $("#decorations-header").find("th");
        decoHeaders.each((i, th) => {
            let outerWidth = $(th).outerWidth();
            headerWidths.set(outerWidth, 1);
            if (outerWidth > maxWidth) maxWidth = outerWidth;
        });

        let activeSchemeHeaderWidth = $("#active-scheme-header").outerWidth();

        if (headerWidths.size > 1 || maxWidth > activeSchemeHeaderWidth) {
            let currentDecoTableWidth = messageViewerManager.decorationTable.outerWidth();
            maxWidth = (maxWidth > activeSchemeHeaderWidth) ? activeSchemeHeaderWidth : maxWidth;
            console.log("headers");

            let newWidth = maxWidth * (messageViewerManager.codeSchemeOrder.length - 1); // dont count active scheme at index 0
            containerObj.width(containerObj.width() + (newWidth - currentDecoTableWidth) + 30);
            messagePanel.css("width", "");
            tableCol.css("width", "");
        }

        messageViewerManager.decorationTable.css("width", maxWidth * (messageViewerManager.codeSchemeOrder.length - 1));
        //messageViewerManager.decorationTable.find("thead").css("width", maxWidth * (messageViewerManager.codeSchemeOrder.length-1));
        $("#decorations-header").css("min-width", maxWidth * (messageViewerManager.codeSchemeOrder.length - 1));

        $("body").scrollLeft(0);
    }
};
