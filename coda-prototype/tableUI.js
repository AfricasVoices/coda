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
    messagePanel: {},
    messageTable: {},
    decorationTable: {},
    codeSchemeOrder: [],
    activeScheme: "",
    tablePages: [], // list of objects {start: [sessionIndex, eventIndex], end: [sessionIndex, eventIndex]}
    rowsInTable : 0,
    lastLoadedPageIndex : 0,
    lastTableY: 0,
    isProgramaticallyScrolling: false,
    sortUtils: new SortUtils(),
    currentSort: null,
    firstScheme: "",
    horizontal: true,
    minHeaderWidth: 155,
    maxHeaderWidth: 255,
    averageRowHeight: "",
    lastEventIndex: 0,

    init: function(messageContainer, data, rowsInTable) {

        if (!rowsInTable) rowsInTable = 40;
        this.rowsInTable = rowsInTable;

        this.messagePanel = messageContainer;
        this.messageTable = $("#message-table");
        this.decorationTable = $("#deco-table");
        this.lastLoadedPageIndex = 1;
        this.currentSort = this.sortUtils.restoreDefaultSort;

        if (!data) {
            this.buildTable();

        } else {
            newDataset.restoreDefaultSort();
            this.buildTable(data, rowsInTable);

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
                if (targetElement.nodeName !== "TD") {
                    if (targetElement.nodeName === "P") {
                        targetElement = targetElement.parentElement.parentElement;
                    }
                    if (targetElement.nodeName === "DIV") {
                        targetElement = targetElement.parentElement;
                    }
                }

                if (targetElement.nodeName === "TD" && targetElement.className.split(" ").indexOf("message-text") !== -1) {
                    messageViewerManager.collectWords(targetElement);
                }
            });

            this.messagePanel.on("scroll", (throttle(function(event) {
                // todo need to know if scroll is from shortcut or manual

                let infiniteScroll = messageViewerManager.infiniteScroll(event);
                let eventIndex = (messageViewerManager.lastLoadedPageIndex - 1) * Math.floor(messageViewerManager.rowsInTable/2) + Math.floor(messageViewerManager.messagePanel.scrollTop() / messageViewerManager.averageRowHeight);
                console.log("eventindex: " + eventIndex + ", lasteventindex: " + messageViewerManager.lastEventIndex);
                if (((infiniteScroll === "UP") && eventIndex <= messageViewerManager.lastEventIndex) || (infiniteScroll === "DOWN") && eventIndex >= messageViewerManager.lastEventIndex) {
                    messageViewerManager.lastEventIndex = eventIndex;
                }
                if (infiniteScroll.length > 0) {
                    scrollbarManager.redrawThumbAtEvent(messageViewerManager.lastEventIndex);
                }
            }, 1)));

            this.messagePanel.on("scroll", function(){
                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.lastTableY = messageViewerManager.messagePanel.scrollTop();
            });

            this.messageTable.dblclick(function(event) {
                if (event.originalEvent.target.className === "highlight") {
                    let codeId = $(event.originalEvent.target).attr("codeid");
                    let scheme = newDataset.findSchemeByCode(codeId);

                    if (scheme) {
                        scheme = scheme.id;
                        $(".scheme-header[scheme='" + scheme + "']").find(".edit-scheme-button").trigger("click"); // opens editor
                        $(".code-row[codeid='" + codeId + "']").trigger("click"); // make the right code row active

                        // bring code row into view if necessary

                        // scroll down to the word field and focus on it
                        $("#code-details-panel").scrollTop($("#color-pick").outerHeight() + $("#regex-user").outerHeight() + 30);
                    }
                }
            });

            let sortButtons = $(".sort-btn");
            sortButtons.off("click");
            sortButtons.on("click", messageViewerManager.sortHandler);

            console.timeEnd("dropdown init");
            console.time("shortcuts init");
            $(window).on("keypress", this.manageShortcuts);
            console.timeEnd("shortcuts init");

            window.addEventListener("mousewheel", () => {
                messageViewerManager.isProgramaticallyScrolling = false;
            });

        }
    },

    sortHandler : function(event) {

        // sorting by another column currently doesn't change the active scheme

        console.time("sort");

        let iconClassesNext = {
            "icon-def": "icon-cat", // current: default on-load order
            "icon-cat" : "icon-conf", // current: sort by code + conf
            "icon-conf" : "icon-def" // current: sort by confidence - when we want global minimum confidence
        };

        $(".sort-btn").find("div.active").toggleClass("active");

        let targetElement = event.originalEvent.target;
        let elementClass;
        if (targetElement.nodeName === "DIV") {
            elementClass = targetElement.className.split(" ")[0];
        } else if (targetElement.nodeName ===  "BUTTON") {
            elementClass = "sort-btn";
        }

        if (elementClass === "sort-btn" || elementClass=== "sort-icon") {
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

            if (!activeRow || activeRow.length === 0) {
                activeRow = $(".message-row").filter(":first");
            }
            messageViewerManager.bringEventIntoView(activeRow.attr("eventid"));

            // redraw scrollbar
            const thumbPosition = scrollbarManager.getThumbPosition();
            scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
            scrollbarManager.redrawThumb(thumbPosition);

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
        messageViewerManager.isProgramaticallyScrolling = true;
    },

    buildTable: function(data, rowsPerPage, hasDataChanged) {
        if (!data) {

            let tableTbody = messageViewerManager.messageTable.find("tbody");
            tableTbody.append("<tr><td colspan='3'>Start by loading in data from Dataset menu</td></tr>");
            return;
        }

        if (typeof hasDataChanged === "undefined") {
            // checks if this is a result of UNDO/REDO action or new data was loaded in
            hasDataChanged = true;
        }

        /*
        Reset all css set when resizing programatically
         */
        if (hasDataChanged) {
            messageViewerManager.messageTable.stickyTableHeaders("destroy");
            messageViewerManager.messageTable.find(".scheme-header").remove();
            messageViewerManager.messageTable.find("tbody").empty();
            $("#message-viewer").css("width", "");
            newDataset.restoreDefaultSort();

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

        let activeSchemeHeader = $(".active-scheme-header");
        activeSchemeHeader.empty();
        let otherSchemeHeaders = $("#decorations-header");
        otherSchemeHeaders.empty();

        // establish sorting
        if (!hasDataChanged && data.schemes[messageViewerManager.activeScheme]) {
            if (this.currentSort === this.sortUtils.sortEventsByConfidenceOnly) {
                newDataset.sortEventsByConfidenceOnly(messageViewerManager.activeScheme);
            }
            if (this.currentSort === this.sortUtils.sortEventsByScheme) {
                newDataset.sortEventsByScheme(messageViewerManager.activeScheme,true);
            }
            if (this.currentSort === this.sortUtils.restoreDefaultSort) {
                newDataset.restoreDefaultSort();
            }
        }

        let allSchemeHeaders = messageViewerManager.messageTable.find("thead").find("tr");
        allSchemeHeaders = $(messageViewerManager.buildJoinedHeader(messageViewerManager.activeScheme)).appendTo(allSchemeHeaders);

        // setup listeners
        allSchemeHeaders.each((i,col) => {
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
                messageViewerManager.resizeViewport(messageViewerManager.minHeaderWidth);
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

        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        if (hasDataChanged) {
            messageViewerManager.lastLoadedPageIndex=1;
        }

        let messageTableTbody = "";
        let iterationStop = messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.eventOrder.length ? newDataset.eventOrder.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;
        for (let i = (messageViewerManager.lastLoadedPageIndex-1) * halfPage; i < iterationStop; i++) {
            let eventIndex = newDataset.eventOrder[i];
            let eventObj = newDataset.events.get(eventIndex);
            messageTableTbody += messageViewerManager.buildJoinedRow(eventObj, i, eventObj.owner, messageViewerManager.activeScheme);
        }

        let messageTableBodyElement =  messageViewerManager.messageTable.find("tbody");
        let decorationTableBodyElement =  messageViewerManager.decorationTable.find("tbody");

        let prevScroll = this.messagePanel.scrollTop();
        messageTableBodyElement.empty();
        decorationTableBodyElement.empty();

        $(messageTableTbody).appendTo(messageTableBodyElement);

        if (hasDataChanged) {
            this.messagePanel.scrollTop(0);
        } else {
            this.messagePanel.scrollTop(prevScroll);
        }

        messageViewerManager.messageTable.stickyTableHeaders({scrollableArea: messageViewerManager.messagePanel, container:messageViewerManager.messagePanel, fixedOffset: 1});
        console.timeEnd("table building");

        /*
        Scrollbar
         */
        if (!hasDataChanged) {
            scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme ? messageViewerManager.activeScheme : Object.keys(newDataset.schemes)[0]);
        } else {
            scrollbarManager.init(newDataset.sessions, document.getElementById("scrollbar"), 100);
        }

        /*
        Active row handling
        */
        // init
        activeRow = this.messageTable.find("tbody tr").filter(":first");
        activeRow.toggleClass("active");

        // select on click
        this.messageTable.add(this.decorationTable).on('click', 'tbody tr', function() {
            let eventId = $(this).attr("eventid");
            let newActiveRow = messageViewerManager.messageTable.find("tbody tr[eventid='" + eventId + "']");
            newActiveRow.addClass('active').siblings().removeClass('active');
            activeRow = newActiveRow
        });


        // keyboard nav
        $(document).off('keydown');
        $(document).on('keydown', function(event) {

            if (!editorOpen && document.activeElement.nodeName === "BODY") {
                let messagePanel = messageViewerManager.messagePanel;
                if (event.keyCode === 38) { // UP
                    if (messageViewerManager.horizontal && messageViewerManager.codeSchemeOrder[0] !== messageViewerManager.activeScheme) {
                        // make sure active scheme is the one at index 0
                        for (let i = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme); i < messageViewerManager.codeSchemeOrder.length; i++) {
                            messageViewerManager.changeActiveScheme();
                        }
                    }

                    let prev = activeRow.prev();

                    if (prev.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = prev.addClass('active');

                        if (!UIUtils.isRowVisible(prev[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(prev[0], messagePanel[0]);
                        }
                    }
                }

                if (event.keyCode === 40) { // DOWN

                    if (messageViewerManager.horizontal && messageViewerManager.codeSchemeOrder[0] !== messageViewerManager.activeScheme) {
                        // make sure active scheme is the one at index 0

                        for (let i = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme); i < messageViewerManager.codeSchemeOrder.length; i++) {
                            messageViewerManager.changeActiveScheme();
                        }
                    }

                    let next = activeRow.next();

                    if (next.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = activeRow.next().addClass('active');

                        if (!UIUtils.isRowVisible(next[0], messagePanel[0])) {
                            UIUtils.scrollRowToTop(next[0], messagePanel[0]);
                        }

                    }
                }

                if (event.keyCode === 39) { // RIGHT
                    messageViewerManager.changeActiveScheme();
                }

                if (event.keyCode === 13) { // ENTER

                    if ($(document.activeElement).is("input")) {
                        return;
                    }
                    if (messageViewerManager.horizontal && Object.keys(newDataset.schemes).length > 1) {
                        messageViewerManager.horizontalCoding(activeRow.attr("eventid"));
                    } else {
                        messageViewerManager.verticalCoding(activeRow.attr("eventid"));
                    }
                }
            }
        });
    },

    buildSchemeHeaderElement: function(schemeKey, activeSortIcon, isActiveScheme) {

        let activeSchemeClass = "";
        if (isActiveScheme) {
            activeSchemeClass = " active-scheme-header";
        }

        let schemeObj = newDataset.schemes[schemeKey];

        let sortIcon = "<button class='sort-btn btn btn-default btn-xs' data-toggle='tooltip' data-placement='top' title='Sort messages' data-container='body'><div class='sort-icon " + (schemeKey === messageViewerManager.activeScheme ? activeSortIcon + "'" : "icon-def active'") + "></div></button>";
        let editButton = "<button type='button' class='btn btn-default btn-xs edit-scheme-button' data-toggle='tooltip' data-placement='top' title='Edit scheme' data-container='body'><i class='glyphicon glyphicon-edit'></i></button>";
        return "<th class='scheme-header" + activeSchemeClass + "' scheme='" + schemeKey + "'><div>" + sortIcon + editButton + "</div><div class='scheme-name-cont'><i class='scheme-name'>" + schemeObj["name"] + "</i></div></th>";
    },

    changeActiveScheme: function(schemeId) {

        messageViewerManager.messageTable.stickyTableHeaders("destroy");
        // IMPORTANT: clear all style set by sticky table headers...
        $(".scheme-header").not(".active-scheme-header").css({"max-width":"", "min-width": "", "width": "auto"});

        if (!schemeId) {
           /*
           Circular
            */

            let nextActiveSchemeIndex = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme) + 1;
            let nextActiveScheme = nextActiveSchemeIndex >= messageViewerManager.codeSchemeOrder.length ? messageViewerManager.codeSchemeOrder[0] : messageViewerManager.codeSchemeOrder[nextActiveSchemeIndex];

            messageViewerManager.demoteFromActiveScheme(messageViewerManager.activeScheme, true);
            messageViewerManager.promoteToActiveScheme(nextActiveScheme);

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

        messageViewerManager.messageTable.stickyTableHeaders({scrollableArea: messageViewerManager.messagePanel, container:messageViewerManager.messagePanel, fixedOffset: 1});

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
                "messageDetails":"button",
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

        let schemeId = /form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))[1];
        let value = selectElement.val();
        let row = selectElement.parents(".message-row");
        let eventId = $(row).attr("eventid");
        let checkbox = selectElement.siblings("span").find(".checkbox-manual");

        let eventObj = newDataset.events.get(eventId);
        let codeObj = newDataset.schemes[schemeId].getCodeByValue(value);

        if (value.length > 0) {
            // CODED

            // add decoration
            let decoration = eventObj.decorationForName(schemeId);
            if (!decoration || typeof decoration === "undefined") {
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
                        if (color && color.length !== 0 && ($(td).hasClass("message-id") || ($(td).hasClass("deco-container")) && $(td).attr("scheme") === schemeId)) {
                            $(td).css("background-color", color);
                        } else {
                            $(td).css("background-color", "#ffffff");
                        }
                    }

                });
            }

            // check checkbox
            checkbox.prop("checked", true);

            regexMatcher.unwrapHighlights(row.find("p"));
            regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(codeObj.words), codeObj.id);


        } else {
            // UNCODED

            // remove code from event in data structure
            eventObj.uglify(schemeId);

            selectElement.removeClass("coded");
            selectElement.addClass("uncoded");

            // recolor
            if (messageViewerManager.activeScheme === schemeId) {
                row.children("td").each(function (i, td) {
                    if ($(td).hasClass("message-text")) {
                        $(td).css("box-shadow", "");
                    } else {
                        $(td).css("background-color", "#ffffff");
                    }
                });
            }

            // uncheck checkbox
            checkbox.prop("checked", false);
        }

        /*
        Re-sort the dataset and re-draw the table when sorting by confidence/category so items jump to their place!
        Not re-sorting in case of "default" sort because that's not affected by coding

        IMPORTANT - not re-sorting if event was 'uncoded' since then an automated coding will be assigned and item will jump
        and effectively 'hide' to a place that the user can't predict
         */

        if (!messageViewerManager.horizontal || Object.keys(newDataset.schemes).length === 1) {

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
                    tbody += messageViewerManager.buildJoinedRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                }

                $(messageViewerManager.messageTable.find("tbody").empty()).append(tbody);

                /*
                 refresh scrollbar
                 */
                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
                scrollbarManager.redrawThumb(thumbPos);
            }

            setTimeout(() => {
                messageViewerManager.verticalCoding(eventId);
            }, 250);

        } else {
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

    dropdownChange : function(event, manual) {

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
                select.find("option").attr("selected",false);
                select.find("option[codeid='" + deco.code.id + "']").attr("selected", true);

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
                select.find("option").attr("selected",false);
                select.find("option.unassign").attr("selected",true);
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
            checkbox.prop("checked",false);

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
                nextMessageRowIndex = newDataset.eventOrder.length-1;
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
                    let newMessageRow = messageViewerManager.bringEventIntoView(nextEventId);

                    if (offset.top < messageViewerManager.messagePanel.height() && offset.top > messageViewerManager.messageTable.find("thead").height()) {
                        messageViewerManager.isProgramaticallyScrolling = true;
                        messageViewerManager.messagePanel.scrollTop(messageViewerManager.messagePanel.scrollTop() + (offset.top - newMessageRow.offset().top));
                    }
                }, 350);
            }
        }
    },

    addNewSchemeColumn: function(scheme) {

        if (scheme["codes"].size === 0) return; // shouldnt happen because fields are validated

        regexMatcher.codeDataset(scheme["id"]);
        messageViewerManager.addNewActiveScheme(scheme["id"]);
        let thumbPos = scrollbarManager.getThumbPosition();
        scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
        scrollbarManager.redrawThumb(thumbPos);
    },

    deleteSchemeColumn: function(schemeId) {

        messageViewerManager.messageTable.stickyTableHeaders("destroy");
        // IMPORTANT: clear all style set by sticky table headers...
        $(".scheme-header").not(".active-scheme-header").css({"max-width":"", "min-width": "", "width": "auto"});

        let activeSchemeInHtml = $(".active-scheme-header").attr("scheme");

        $(".scheme-header[scheme='" + schemeId + "']").remove();
        $(".deco-container[scheme='" + schemeId + "']").remove();
        if (schemeId === activeSchemeInHtml) {
            // change active scheme plus redraw decorations table with header
            let indexOfActiveScheme = messageViewerManager.codeSchemeOrder.indexOf(schemeId);
            let nextActiveScheme = (indexOfActiveScheme + 1 < messageViewerManager.codeSchemeOrder.length) ? indexOfActiveScheme + 1 : 0;
            messageViewerManager.promoteToActiveScheme(messageViewerManager.codeSchemeOrder[nextActiveScheme]);
            let thumbPos = scrollbarManager.getThumbPosition();
            scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
            scrollbarManager.redrawThumb(thumbPos);
        }

        messageViewerManager.resizeViewport(messageViewerManager.minHeaderWidth);
        messageViewerManager.messageTable.stickyTableHeaders({scrollableArea: messageViewerManager.messagePanel, container:messageViewerManager.messagePanel, fixedOffset: 1});


        return this.activeScheme;
    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");
        var schemeId = scheme.id;
        $(editButton).off("click");
        $(editButton).on("click", function(event) {

            let button = event.target;
            scheme = newDataset.schemes[schemeId];
            tempScheme = CodeScheme.clone(scheme);
            let header = $(button).parents(".scheme-header");

            if (!(codeEditor.is(":visible"))) {

                editorOpen = true;
                let values = Array.from(tempScheme.codes.values()); // todo rewrite to use iterator
                values.forEach(function (codeObj) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], codeObj["id"], codeObj["words"]);
                });

                codeEditorManager.bindSaveEditListener(header);

                $("#scheme-name-input").val(scheme["name"]);

                codeEditor.show();

                // need to update code panel after editor is displayed so that the width is set correctly!
                codeEditorManager.updateCodePanel(values[values.length-1]);

                let firstCodeRow = codeEditor.find(".code-row").filter(":first");
                firstCodeRow.trigger("click");


                // update the activity stack
                storage.saveActivity({
                    "category": "SCHEME",
                    "message": "Editing existing scheme",
                    "messageDetails": {"scheme":scheme.id},
                    "data": scheme.toJSON(),
                    "timestamp": new Date()
                });
            }
        });
    },

    manageShortcuts : function(event) {
        if (!editorOpen && messageViewerManager.activeScheme && activeRow && messageViewerManager.activeScheme.length > 0 && activeRow.length) {

            let shortcuts = newDataset.schemes[messageViewerManager.activeScheme].getShortcuts();
            if (shortcuts.has(event.keyCode)) {
                let codeObj = shortcuts.get(event.keyCode);
                let eventId = $(activeRow).attr("eventid");
                $(activeRow).children("td").each(function(i, td) {
                    newDataset.events.get(eventId).decorate(codeObj.owner["id"], true, UUID, codeObj, 0.95);
                    let color = codeObj["color"];
                    console.log(td);
                    if ($(td).hasClass("message-text")) {
                        if (color && color.length !== 0 && color !== "#ffffff") {
                            $(td).css("box-shadow", "inset 0px 0px 0px 4px " + color);
                        } else {
                            $(td).css("box-shadow", "");
                        }
                    } else if ($(td).hasClass("active-scheme")){
                        // set dropdown value
                        $(td).find("select").val(codeObj["value"]).removeClass("uncoded").addClass("coded");

                        // check checkbox
                        $(td).find(".checkbox-manual").prop("checked", true);
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

                if (messageViewerManager.horizontal && Object.keys(newDataset.schemes).length > 1) {
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
        let nextEventId;
        let nextEventRow = null;
        let currentEventIndex = newDataset.eventOrder.indexOf(eventId);
        if (currentEventIndex+1 < newDataset.eventOrder.length) {
            for (let i = currentEventIndex+1; i < newDataset.eventOrder.length; i++) {
                let eventObj = newDataset.events.get(newDataset.eventOrder[i]);
                let deco = eventObj.decorations.get(messageViewerManager.activeScheme);
                if (!deco || !deco.code) {
                    nextEventId = eventObj.name;
                    break;
                }
            }
        }

        if (!nextEventId) {
            for (let i = 0; i < currentEventIndex+1; i++) {
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
            nextEventRow = messageViewerManager.bringEventIntoView(newDataset.events.get(newDataset.eventOrder[currentEventIndex+1]));
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
                let immutableSchemeOrder = messageViewerManager.codeSchemeOrder.slice(messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme));
                for (let schemeKey of immutableSchemeOrder) {
                    if (schemeKey === nextScheme) {
                        break;
                    } else {
                        messageViewerManager.changeActiveScheme();
                    }
                }
            }, 750);

        } else {
            // go to next uncoded event
            // keep codescheme order

            setTimeout(() => {

                let nextEventIndex = newDataset.eventOrder.indexOf(eventId);
                let firstScheme = messageViewerManager.codeSchemeOrder[0];
                let uncodedScheme = "";

                let nextEventObj = newDataset.events.get(newDataset.eventOrder[nextEventIndex]);
                while (nextEventObj && nextEventObj.decorations.get(firstScheme) && nextEventObj.decorations.get(firstScheme).code && nextEventIndex < newDataset.eventOrder.length) {
                    nextEventIndex++;
                    nextEventObj = newDataset.events.get(newDataset.eventOrder[nextEventIndex]);
                    if (!nextEventObj || typeof nextEventObj === "undefined" ) {

                        uncodedScheme = eventObj.firstUncodedScheme(messageViewerManager.codeSchemeOrder);
                        if (uncodedScheme.length > 0) {
                            let activeSchemeIndex = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme);
                            let uncodedSchemeIndex = messageViewerManager.codeSchemeOrder.indexOf(uncodedScheme);

                            if (activeSchemeIndex < uncodedSchemeIndex) {
                                for (let i =activeSchemeIndex; i < uncodedSchemeIndex; i++) {
                                    messageViewerManager.changeActiveScheme();
                                }

                            } else {
                                for (let i =activeSchemeIndex; i < messageViewerManager.codeSchemeOrder.length; i++) {
                                    messageViewerManager.changeActiveScheme();
                                }
                                for (let i = 0 ; i < uncodedSchemeIndex; i++) {
                                    messageViewerManager.changeActiveScheme();
                                }
                            }
                        }
                        return;
                    }
                }

                if (firstScheme.length !== 0) {
                    //change active row & active scheme to first scheme
                    let newActiveEvent = newDataset.events.get(newDataset.eventOrder[nextEventIndex]);
                    let eventRow = messageViewerManager.bringEventIntoView(newActiveEvent.name);

                    if (eventRow && eventRow.length > 0) {
                        // change active scheme!
                        for (let i = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme); i < messageViewerManager.codeSchemeOrder.length; i++) {
                            messageViewerManager.changeActiveScheme();
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
    },

    bringEventIntoView: function(eventId) {
        let eventRow = $(".message-row[eventid='" + eventId + "']");
        let eventIndex = newDataset.eventOrder.indexOf(eventId);
        activeRow.removeClass('active');

        if (!eventRow || eventRow.length === 0) {
            // this event is not loaded in the table
            // 1. find out what page of events it's in
            // 2. load the appropriate pair of pages in

            let pageIndex = Math.floor(eventIndex / Math.floor(messageViewerManager.rowsInTable / 2));

            // load in pages at index pageIndex & pageIndex-1 except if pageIndex-1 is out of range!
            let messageTableTbody = "";
            if (pageIndex === 0 || pageIndex === -1) {
                // load 0th and 1st
                // also cover the broken case of no index found
                messageTableTbody += messageViewerManager.createJoinedPageHTML(0);
                messageTableTbody += messageViewerManager.createJoinedPageHTML(1);

                messageViewerManager.lastLoadedPageIndex = 1;

            } else if (pageIndex > 0) {
                messageTableTbody += messageViewerManager.createJoinedPageHTML(pageIndex-1);
                messageTableTbody += messageViewerManager.createJoinedPageHTML(pageIndex);

                messageViewerManager.lastLoadedPageIndex = pageIndex;

            }

            let currentMessageTbody = messageViewerManager.messageTable.find("tbody");
            currentMessageTbody.empty();
            $(messageTableTbody).appendTo(currentMessageTbody);

            eventRow = $(".message-row[eventid='" + eventId + "']");

            if (eventRow && eventRow.length > 0) {
                eventRow.addClass('active');
                activeRow = eventRow;

                if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messagePanel[0])) {
                    messageViewerManager.isProgramaticallyScrolling = true;
                    UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messagePanel[0]);
                }

                scrollbarManager.redrawThumbAtEvent(eventIndex);
                messageViewerManager.lastEventIndex = eventIndex;
            }

        } else {
            eventRow.addClass('active');
            activeRow = eventRow;

            if (!UIUtils.isRowVisible(eventRow[0], messageViewerManager.messagePanel[0])) {
                messageViewerManager.isProgramaticallyScrolling = true;
                UIUtils.scrollRowToTop(eventRow[0], messageViewerManager.messagePanel[0]);
            }
            scrollbarManager.redrawThumbAtEvent(eventIndex);
            messageViewerManager.lastEventIndex = eventIndex;
        }

        let selectField = eventRow.find("select." + messageViewerManager.activeScheme);
        selectField.focus();
        return eventRow;
    },

    infiniteScroll : function() {

        let currentY = messageViewerManager.messagePanel.scrollTop();
        if (currentY === messageViewerManager.lastTableY || messageViewerManager.isProgramaticallyScrolling) {
            return "";
        }

        if (currentY > messageViewerManager.lastTableY) {
            if (UIUtils.isScrolledToBottom(messageViewerManager.messagePanel)) {
                console.time("infinite scroll DOWN");

                let nextPage = messageViewerManager.lastLoadedPageIndex + 1;

                if (nextPage >= Math.floor(newDataset.eventOrder.length / Math.floor(messageViewerManager.rowsInTable/2))) {
                    console.log("ehh");
                }

                if (nextPage < Math.floor(newDataset.eventOrder.length / Math.floor(messageViewerManager.rowsInTable/2))) {

                    messageViewerManager.lastLoadedPageIndex = nextPage;

                    let messageTableTbody = "";
                    messageTableTbody += messageViewerManager.createJoinedPageHTML(nextPage);

                    let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");

                    let lastMessage = messageTableTbodyElement.find(".message-row").last();
                    let lastMessagePosition = lastMessage.position().top;

                    let elementsToRemoveFromMessageTable = messageTableTbodyElement.find("tr:nth-child(-n+" + Math.floor(messageViewerManager.rowsInTable/2) + ")");

                    elementsToRemoveFromMessageTable.remove();

                    $(messageTableTbody).appendTo(messageTableTbodyElement);

                    console.log("new page added");

                    activeRow.removeClass("active");
                    lastMessage.addClass("active");
                    activeRow = lastMessage;

                    messageViewerManager.isProgramaticallyScrolling = true;
                    messageViewerManager.messagePanel.scrollTop($("#message-panel").scrollTop() + (-1 * (lastMessagePosition - lastMessage.position().top)));
                    messageViewerManager.lastTableY = messageViewerManager.messagePanel.scrollTop();
                    //scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);

                    let thumbPos = scrollbarManager.getThumbPosition();
                    scrollbarManager.redrawThumb(thumbPos);
                    messageViewerManager.averageRowHeight = Math.floor(messageViewerManager.messageTable.height()/messageViewerManager.rowsInTable);
                    if (messageViewerManager.averageRowHeight === 0) {
                        console.log("fail");
                    }

                    console.timeEnd("infinite scroll DOWN");

                } else if (Math.floor(newDataset.eventOrder.length / Math.floor(messageViewerManager.rowsInTable/2)) - nextPage <= 0 && $(".message-row").length === 40) {
                    let halfPage = Math.floor(messageViewerManager.rowsInTable/2);

                    let messageTableTbody = "";
                    for (let i = 0; i < (newDataset.eventOrder.length - (nextPage * halfPage)); i++) {
                        let eventKey = newDataset.eventOrder[(nextPage-1) * halfPage + halfPage + i];
                        if (eventKey) {
                            messageTableTbody += messageViewerManager.buildJoinedRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
                        }
                    }

                    let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");

                    let lastMessage = messageTableTbodyElement.find(".message-row").last();
                    let lastMessagePosition = lastMessage.position().top;

                    $(messageTableTbody).appendTo(messageTableTbodyElement);

                    activeRow.removeClass("active");
                    lastMessage.addClass("active");
                    activeRow = lastMessage;

                    messageViewerManager.isProgramaticallyScrolling = true;
                    messageViewerManager.messagePanel.scrollTop($("#message-panel").scrollTop() + (-1 * (lastMessagePosition - lastMessage.position().top)));
                    messageViewerManager.lastTableY = messageViewerManager.messagePanel.scrollTop();
                    messageViewerManager.averageRowHeight = Math.floor(messageViewerManager.messageTable.height()/messageViewerManager.rowsInTable);
                    if (messageViewerManager.averageRowHeight === 0) {
                        console.log("fail");
                    }

                    let thumbPos = scrollbarManager.getThumbPosition();
                    scrollbarManager.redrawThumb(thumbPos);

                }
            }
            return "DOWN";

        } else if (currentY < messageViewerManager.lastTableY){

            if (UIUtils.isScrolledToTop(messageViewerManager.messagePanel)) {

                if (messageViewerManager.lastLoadedPageIndex !== 1 ) {
                    console.time("infinite scroll UP");

                    let prevPage = messageViewerManager.lastLoadedPageIndex - 2;
                    messageViewerManager.lastLoadedPageIndex--;
                    let messageRows = $(".message-row");
                    let firstRow = messageRows.first();
                    let originalOffset = firstRow.position().top;

                    let messageTableTbody = "";
                    messageTableTbody += messageViewerManager.createJoinedPageHTML(prevPage);

                    let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");

                    let numRowsToRemove = 0;
                    if (messageRows.length !== messageViewerManager.rowsInTable) {
                        numRowsToRemove =  Math.floor(messageViewerManager.rowsInTable/2) + messageRows.length % messageViewerManager.rowsInTable;
                    } else {
                        numRowsToRemove = Math.floor(messageViewerManager.rowsInTable/2);
                    }

                    messageTableTbodyElement.find("tr:nth-last-child(-n+" + numRowsToRemove + ")").remove();

                    $(messageTableTbody).prependTo(messageTableTbodyElement);

                    activeRow.removeClass("active");
                    firstRow.addClass("active");
                    activeRow = firstRow;

                    // adjust scrollTop of the panel so that the previous top row stays on top of the table (and not out of view)
                    let newOffset = firstRow.position().top;
                    messageViewerManager.isProgramaticallyScrolling = true;
                    messageViewerManager.messagePanel.scrollTop(messageViewerManager.messagePanel.scrollTop()+ (-1 * (originalOffset - newOffset)));
                    messageViewerManager.lastTableY = messageViewerManager.messagePanel.scrollTop();

                    messageViewerManager.averageRowHeight = Math.floor(messageViewerManager.messageTable.height()/messageViewerManager.rowsInTable);
                    if (messageViewerManager.averageRowHeight === 0) {
                        console.log("fail");
                    }
                    let thumbPos = scrollbarManager.getThumbPosition();
                    scrollbarManager.redrawThumb(thumbPos);

                    console.timeEnd("infinite scroll UP");
                }
            }
            return "UP";
        }
    },

    createJoinedPageHTML: function(index) {

        let tbody = "";

        const halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (index * halfPage + halfPage > newDataset.eventOrder.length) ? newDataset.eventOrder.length : index * halfPage + halfPage;

        for (let i = index * halfPage; i < stoppingCondition; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildJoinedRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner, messageViewerManager.activeScheme);
        }

        return tbody;
    },


    buildJoinedRow: function(eventObj, eventIndex, sessionId, activeSchemeKey) {

        if (!eventObj) {
            console.log("undefined");
            return;
        }

        if (!activeSchemeKey) activeSchemeKey = messageViewerManager.activeScheme;

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

        let shadowStyle = (rowColor === "#ffffff") ? "" : " box-shadow: inset 0px 0px 0px 4px " + rowColor; // coloured shadow around message text

        eventRow += "<tr class='message-row' id='message-" + eventObj["name"] + "' eventid = '" + eventObj["name"] + "' eventindex = '" + eventIndex + "' sessionId = '" + sessionId + "'>";
        eventRow += "<td class='message-id' style='width:67px;background-color: " + rowColor + "'><div>" + eventObj["name"] + "</div></td>";
        eventRow += "<td class='message-text' style='width:400px;" + shadowStyle + "'><div><p>" + eventText + "</p></div></td>";

        eventRow += messageViewerManager.buildSchemeRowCell(eventObj, messageViewerManager.activeScheme, true);
        let indexOfActiveScheme = messageViewerManager.codeSchemeOrder.indexOf(messageViewerManager.activeScheme);
        for (let i = indexOfActiveScheme + 1; i < messageViewerManager.codeSchemeOrder.length; i++) {
            eventRow += messageViewerManager.buildSchemeRowCell(eventObj, messageViewerManager.codeSchemeOrder[i], false);
        }
        for (let i = 0; i < indexOfActiveScheme; i++) {
            eventRow += messageViewerManager.buildSchemeRowCell(eventObj, messageViewerManager.codeSchemeOrder[i], false);
        }

        eventRow += "</td>";
        eventRow += "</tr>";

        return eventRow;
    },

    buildJoinedHeader: function(activeSchemeKey) {

        let header = "";
        header += messageViewerManager.buildSchemeHeaderCell(activeSchemeKey, true);
        let indexOfActiveScheme = messageViewerManager.codeSchemeOrder.indexOf(activeSchemeKey);
        for (let i = indexOfActiveScheme + 1; i < messageViewerManager.codeSchemeOrder.length; i++) {
            header += messageViewerManager.buildSchemeHeaderCell(messageViewerManager.codeSchemeOrder[i], false);
        }
        for (let i = 0; i < indexOfActiveScheme; i++) {
            header += messageViewerManager.buildSchemeHeaderCell(messageViewerManager.codeSchemeOrder[i], false);
        }

        return header;

    },

    buildSchemeHeaderCell: function(schemeKey, isActive, activeSortIcon) {
        if (!schemeKey) return;

        if (!activeSortIcon) activeSortIcon = "icon-def";

        if (typeof isActive === "undefined") isActive = false;

        let schemeObj = newDataset.schemes[schemeKey];

        let sortIcon = "<button class='sort-btn btn btn-default btn-xs' data-toggle='tooltip' data-placement='top' title='Sort messages' data-container='body'><div class='sort-icon " + (schemeKey === messageViewerManager.activeScheme ? activeSortIcon + "'" : "icon-def active'") + "></div></button>";
        let editButton = "<button type='button' class='btn btn-default btn-xs edit-scheme-button' data-toggle='tooltip' data-placement='top' title='Edit scheme' data-container='body'><i class='glyphicon glyphicon-edit'></i></button>";
        let columnDiv = "";

        if (isActive) {
           columnDiv += "<th class='active-scheme-header scheme-header' scheme='" + schemeKey + "'><div>" + sortIcon + editButton + "</div><div class='scheme-name-cont'><i class='scheme-name'>" + schemeObj["name"] + "</i></div>" +  "</th>";
        } else {
            columnDiv += "<th class='scheme-header' scheme='" + schemeKey + "'><div>" + sortIcon + editButton + "</div><div class='scheme-name-cont'><i class='scheme-name'>" + schemeObj["name"] + "</i></div>" +  "</th>";
        }

        return columnDiv;
    },

    buildSchemeRowCell: function(eventObj, schemeId, isActive) {
        if (!eventObj || !schemeId || !newDataset.schemes[schemeId]) {
            return;
        }

        if (typeof isActive === "undefined") isActive = false;

        let rowColor = "#ffffff";
        let activeDecoration = eventObj["decorations"].get(schemeId);
        if (activeDecoration && activeDecoration.code) {
            let parentSchemeCodes = activeDecoration.code.owner instanceof CodeScheme ? activeDecoration.code.owner.codes : newDataset.schemes[activeDecoration.code.owner].codes;

            if (!parentSchemeCodes.has(activeDecoration.code.id)) {
                // in case the event object is still coded with a code that doesn't exist in the scheme anymore
                eventObj.uglify(activeDecoration.scheme_id);

            } else if (activeDecoration.code.color && activeDecoration.code.color.length !== 0 && isActive) {
                rowColor = activeDecoration.code.color;
            }
        }


        let schemRowCell = "";
        schemRowCell += "<td class='deco-container" +  (isActive ? " active-scheme" : "") + "' style='background-color:" + rowColor+ "' scheme='" + schemeId+ "'>";
        schemRowCell += "<div class='input-group' scheme='" + schemeId + "' >";
        let disabled = (!isActive) ? "disabled" : "";
        if (eventObj.decorations.get(schemeId) && eventObj.decorations.get(schemeId).manual) {
            schemRowCell += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' checked " + disabled +"></span>";
        } else {
            schemRowCell += "<span class='input-group-addon'><input class='checkbox-manual' type='checkbox' " + disabled +"></span>";
        }

        schemRowCell += this.buildCodeSelectField(newDataset.schemes[schemeId],eventObj,isActive);
        schemRowCell += "</div>";
        schemRowCell += "</td>";

        return schemRowCell;
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

        let currentActiveSchemeHeaderContainer = $("th.active-scheme-header");
        let demotedHeader = currentActiveSchemeHeaderContainer;

        currentActiveSchemeHeaderContainer.css({"width":"auto"});
        currentActiveSchemeHeaderContainer.removeClass("active-scheme-header");
        currentActiveSchemeHeaderContainer.find("i.scheme-name").removeClass("active-scheme");

        if (moveToBack) {
            demotedHeader.detach();
            messageViewerManager.messageTable.find("thead").find("tr").append(demotedHeader);
        }

        // pass message rows and move active cell to end of the decorations table
        $(".message-row").each((i, tr) => {

            let activeSchemeCell = $(tr).find(".active-scheme");
            activeSchemeCell.removeClass("active-scheme");

            if (moveToBack) activeSchemeCell.detach();

            activeSchemeCell.find("select").attr("disabled","");
            activeSchemeCell.find(".checkbox-manual").attr("disabled","");

            // remove all color
            activeSchemeCell.css({"background-color": "", "box-shadow":""});

            if (moveToBack) {
                $(tr).append(activeSchemeCell);
            }
        });

    },

    promoteToActiveScheme(schemeKey) {
        // all listeners will stay active if just detaching and appending elements

        schemeKey = schemeKey + ""; //coerce to string

        /*
        reattach active scheme header
         */

        let newActiveHeader = $(".scheme-header[scheme='" + schemeKey + "']");
        let headerAlreadyInPlace = newActiveHeader.is($(".scheme-header:first"));

        if (headerAlreadyInPlace) {
            // only apply stylistic changes as the column is already in the right place
            // no moving around required
            newActiveHeader.addClass("active-scheme-header");
            newActiveHeader.find("i.scheme-name").addClass("active-scheme");
            newActiveHeader.css("width", "300px");
        } else {
            newActiveHeader = newActiveHeader.detach();
            newActiveHeader.find("i.scheme-name").addClass("active-scheme");
            newActiveHeader.addClass("active-scheme-header");
            messageViewerManager.messageTable.find("thead").find("#message-text-header").after(newActiveHeader);
            newActiveHeader.css("width", "300px");
        }


        /*
        add new cells to activescheme column
         */
        let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
        messageTableTbodyElement.find(".message-row").each((i, messageRow) => {

            let eventObj = newDataset.events.get($(messageRow).attr("eventid"));

            let activeSchemeCell = $(messageRow).find(".deco-container[scheme='" + schemeKey + "']");
            let messageTextCell = $(messageRow).find(".message-text");
            let idCell = $(messageRow).find(".message-id");
            activeSchemeCell.addClass("active-scheme");

            let eventDeco = eventObj.decorations.get(schemeKey);
            if (eventDeco && eventDeco.code) {
                let color = eventDeco.code["color"];
                activeSchemeCell.css({
                    // N.B. message text cells are recoloured in change active scheme
                    // this function only deals with the actual active scheme column
                    "background-color" : (color && color.length !== 0 ) ? color : "#ffffff",
                    "width": "300px"

                });

                idCell.css({
                    "background-color" : (color && color.length !== 0) ? color : "#ffffff"
                });

                messageTextCell.css({
                    "box-shadow": (color && color.length !== 0 && color !== "#ffffff" ) ? "inset 0px 0px 0px 4px " + color : ""
                });

                // remove all highlights
                regexMatcher.unwrapHighlights($(messageRow).find("p"));
                regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(eventDeco.code.words), eventDeco.code.id);
            } else {
                activeSchemeCell.css({
                    // N.B. message text cells are recoloured in change active scheme
                    // this function only deals with the actual active scheme column
                    "background-color" : ""
                });

                idCell.css({
                    "background-color" : ""
                });

                messageTextCell.css({
                    "box-shadow": ""
                });

                // remove all highlights
                regexMatcher.unwrapHighlights($(messageRow).find("p"));
            }

            let activeSchemeCellInputGroup = activeSchemeCell.find(".input-group");
            activeSchemeCellInputGroup.find("select").removeAttr("disabled");
            activeSchemeCellInputGroup.find(".checkbox-manual").removeAttr("disabled");

            if (!headerAlreadyInPlace) {
                messageTextCell.after(activeSchemeCell);
            }

        });

    },

    addNewActiveScheme(schemeKey) {
        schemeKey = schemeKey + ""; //coerce to string

        /*
        build active scheme header
         */

        messageViewerManager.messageTable.stickyTableHeaders("destroy");
        // IMPORTANT: clear all style set by sticky table headers...
        $(".scheme-header").css({"max-width":"", "min-width": "", "width": "auto"});
        $(".active-scheme-header").removeClass("active-scheme-header");
        $("i.scheme-name").removeClass("active-scheme");

        let newHeader = $(messageViewerManager.buildSchemeHeaderElement(schemeKey, "icon-def", true)).insertAfter($("#message-text-header"));
        newHeader.css("width", "300px");

        // init listeners
        $(newHeader).find("i.scheme-name").on("click", event => {
            let schemeHeaderContainer = $(event.target).parents(".scheme-header"); // coding scheme header - container for buttons and name of particular scheme
            let schemeId = schemeHeaderContainer.attr("scheme");
            setTimeout(() => {
                messageViewerManager.changeActiveScheme(schemeId);
                messageViewerManager.resizeViewport(messageViewerManager.minHeaderWidth);
            }, 500);
        });

        $(newHeader).each((i,col) => {
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

        messageViewerManager.messageTable.stickyTableHeaders({scrollableArea: messageViewerManager.messagePanel, container:messageViewerManager.messagePanel, fixedOffset: 1});

        // add new cells to activescheme column
        let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
        messageTableTbodyElement.find(".message-row").each((i, row) => {

            let eventObj = newDataset.events.get($(row).attr("eventid"));

            let activeSchemeTd = $(row).find(".active-scheme");
            activeSchemeTd.removeClass("active-scheme");
            activeSchemeTd.find("select").attr("disabled","");
            activeSchemeTd.find(".checkbox-manual").attr("disabled","");
            activeSchemeTd.css({"background-color": ""});

            regexMatcher.unwrapHighlights($(row).find("p"));

            $(row).find(".message-text").after(messageViewerManager.buildSchemeRowCell(eventObj, schemeKey, true));

            let eventDeco = eventObj.decorations.get(schemeKey);
            if (eventDeco) {
                if (eventDeco.code) {
                    let color = eventDeco.code["color"];
                    $(row).find(".message-text").css({
                        "box-shadow" : (color && color.length !== 0 && color !== "#ffffff" ) ? ("inset 0px 0px 0px 4px " + color) : ""
                        // N.B. message text cells are recoloured in change active scheme
                        // this function only deals with the actual active scheme column
                    });
                    $(row).find(".message-id").css({
                        "background-color" : (color && color.length !== 0) ? color : "#fffff"
                    });

                    regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(eventDeco.code.words), eventDeco.code.id);
                }
            } else {
                $(row).find(".message-text").css({
                    "box-shadow" : ""
                });
                $(row).find(".message-id").css({
                    "background-color" : ""
                });
            }
        });
    },

    collectWords : function(element) {

        if ($(element).prop("tagName") === "TD") {

            let eventId = $(element).closest('tr').attr("eventid");

            if (window.getSelection && window.getSelection() && window.getSelection().toString().length > 0) {

                let selection = window.getSelection().toString(); // todo do we preprocess this in any way?
                console.log(selection);

                selection = selection.trim();
                if (selection.length === 0) {
                    return;
                }

                // check if current row has an assigned code and if yes, add the words to the data structure
                const code = newDataset.events.get(eventId).codeForScheme(messageViewerManager.activeScheme);
                const isCoded = typeof code !== "undefined" && code;

                if (isCoded) {

                    code.addWords([selection]);
                    let regex = regexMatcher.generateOrRegex(code.words);

                    regexMatcher.unwrapHighlights($(element).find("p"));
                    regexMatcher.wrapElement(newDataset.events.get(eventId),regex, code.id);

                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Highlighted string for code in scheme",
                        "messageDetails": {"word": selection, "scheme":code.owner.id, "code": code.id},
                        "data": code,
                        "timestamp": new Date()
                    });
                }
            }
        }
    },

    resizeViewport: function(minWidth){

        // in the current setup, main container will expand for however many pixels are required to
        // give each table cell at least its min-width
        // for this to work the panel has to float left and have an assigned % width of the main container

        messageViewerManager.messageTable.stickyTableHeaders("destroy");

        // IMPORTANT: clear all style set by sticky table headers...
        let schemeHeaders = $(".scheme-header");
        schemeHeaders.css({"max-width":"", "min-width": "", "width": "auto"});

        let messageViewer = $("#message-viewer");
        let activeSchemeHeader = $(".active-scheme-header");
        if (schemeHeaders.length === 2) {
            activeSchemeHeader.css("width", "auto");
            activeSchemeHeader.css("width", $(schemeHeaders[1]).outerWidth() + "px");
            $("#message-text-header").css("width", "400px");
            messageViewer.width(1250);

        } else if (schemeHeaders.length === 1) {
            activeSchemeHeader.css("width", "auto");
            $("#message-text-header").css("width", "auto");
            messageViewer.width(1250);

        } else {
            activeSchemeHeader.css("width", "300px");
            $("#message-text-header").css("width", "400px");

        }

        let allHeadersWideEnough = true;
        let noHeadersTooWide = true;
        schemeHeaders.each((i, header) => {
            if ($(header).hasClass("active-scheme-header")) {
                return true;
            }
            if ($(header).width() < minWidth) {
                allHeadersWideEnough = false;
                return false;
            }
            if ($(header).width() > messageViewerManager.maxHeaderWidth) {
                noHeadersTooWide = false;
                return false;
            }
        });

        if (!allHeadersWideEnough || (!noHeadersTooWide && schemeHeaders.length > 2)) {

            let totalRequiredPanelWidth = $("#message-id-header").outerWidth() + $("#message-text-header").outerWidth() + activeSchemeHeader.outerWidth() + minWidth * (messageViewerManager.codeSchemeOrder.length-1);
            let difference = totalRequiredPanelWidth - $("#message-panel").width();

            let currentContainerWidth = messageViewer.width();
            let newContainerWidth = currentContainerWidth + difference;
            messageViewer.width(currentContainerWidth + difference);

            let scrollThumb = $("#scrollthumb");
            let scrollbar = $("#scrollbar");
            scrollbar.css("margin-left", "0px");

            if (newContainerWidth < 1250) {
                let scrollThumbPosition = scrollThumb.position().left;
                let scrollbarPosition = scrollbar.position().left;
                if (scrollThumbPosition !== scrollbarPosition) {
                    scrollbar.css("margin-left", "-" + (scrollbarPosition - scrollThumbPosition) + "px");
                }
            } else {
                scrollThumb.css("left", scrollbar.position().left + "px");
            }
        }

        messageViewerManager.messageTable.stickyTableHeaders({scrollableArea: messageViewerManager.messagePanel, container:messageViewerManager.messagePanel, fixedOffset: 1});
        $("body").scrollLeft(0);

    }
};