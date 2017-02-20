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

var messageViewerManager = {
    messageContainer: {},
    table: {},
    codeSchemeOrder: [],
    activeScheme: "",
    tablePages: [], // list of objects {start: [sessionIndex, eventIndex], end: [sessionIndex, eventIndex]}
    rowsInTable : 0,
    lastLoadedPageIndex : 0,
    wordBuffer: {}, // format {sessionId :{ eventId: {}} ... }
    lastTableY: 0,
    isProgramaticallyScrolling: false,
    sortUtils: new SortUtils(),
    currentSort: null,

    init: function(messageContainer, data, rowsInTable) {

        if (rowsInTable === undefined) rowsInTable = 40;
        this.rowsInTable = rowsInTable;

        this.messageContainer = messageContainer;
        this.table = messageContainer.find("table");
        this.buildTable(data, rowsInTable);
        this.lastLoadedPageIndex = 1;
        this.currentSort = this.sortUtils.restoreDefaultSort;

        console.time("dropdown init");

        $(document).on("change", function(event) {
            if (event.originalEvent == undefined) return;

                if (event.originalEvent.target.nodeName === "SELECT") {
               messageViewerManager.dropdownChange(event.originalEvent, true);
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

        $("#message-panel").on("scroll", (throttle(function(event) {
            //console.log("scroll height: " + $("#message-table")[0].scrollHeight + ", scroll top: " + $("#message-panel").scrollTop() +  ", outer height: " + $("#message-panel").outerHeight(false));
            // todo need to know if scroll is from shortcut or manual
            messageViewerManager.infiniteScroll(event);

        }, 1)));

        $("#message-panel").on("scroll", function(){
            let yDifference = (messageViewerManager.lastTableY - messageViewerManager.messageContainer.scrollTop())/messageViewerManager.table.height();
            scrollbarManager.redrawThumb(scrollbarManager.getThumbPosition() - scrollbarManager.scrollbarEl.height * yDifference * (messageViewerManager.rowsInTable/newDataset.events.length));


            messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
        });

        $("#message-table").dblclick(function(event) {
           if (event.originalEvent.target.className === "highlight") {
               // open editor
               let scheme = $(event.originalEvent.target).attr("codeid").split("-")[0];
               $(".scheme-col[scheme='" + scheme + "']").find(".edit-scheme-button").trigger("click");
           }

        });

        $("a").on("click", messageViewerManager.sortHandler);

        console.timeEnd("dropdown init");
        console.time("shortcuts init");
        $(window).on("keypress", this.manageShortcuts);
        console.timeEnd("shortcuts init");

    },

    sortHandler : function(event) {

        // todo: decide if on click the active scheme is changed as well

        console.time("sort");

        var iconClassesNext = {
            "glyphicon-sort": "glyphicon-sort-by-attributes", // default on-load order
            "glyphicon-sort-by-attributes" : "glyphicon-sort-by-order", // sort by code + conf
            "glyphicon-sort-by-order" : "glyphicon-sort" // sort by confidence - when we want global minimum confidence
        };
        // todo: do we keep state to know where we are or know from the icon?

        $(".sort-button").find("span.active").toggleClass("active");
        var targetElement = event.originalEvent.target;
        if (targetElement.className === "sort-button" || targetElement.className.split(" ")[0] === "glyphicon") {
            // find which icon was clicked... and use the appropriate sort
            let iconClassName = targetElement.className === "sort-button" ? $(targetElement).children(".glyphicon")[0].className.split(" ")[1] : $(targetElement).attr("class").split(" ")[1];
            let schemeId = $(targetElement).closest("div").attr("scheme");
            if (iconClassName === "glyphicon-sort-by-attributes") {
                // sort as todolist
                newDataset.sortEventsByConfidenceOnly(schemeId);
                messageViewerManager.currentSort = messageViewerManager.sortUtils.sortEventsByConfidenceOnly;

            } else if (iconClassName === "glyphicon-sort") {
                newDataset.sortEventsByScheme(schemeId, true);
                messageViewerManager.currentSort = messageViewerManager.sortUtils.sortEventsByScheme;


            } else if (iconClassName === "glyphicon-sort-by-order") {
                newDataset.restoreDefaultSort();
                messageViewerManager.currentSort = messageViewerManager.sortUtils.restoreDefaultSort;

            }

            if (targetElement.className == "sort-button") {
                let glyphicon = $(targetElement).children(".glyphicon")[0];
                glyphicon.className = glyphicon.className.replace(iconClassName, iconClassesNext[iconClassName] + " active");
            } else {
                targetElement.className = targetElement.className.replace(iconClassName, iconClassesNext[iconClassName] + " active");
            }

            let tbody = "";
            let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);

            let iterationStop = messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.events.length ? newDataset.events.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;

            for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < iterationStop; i++) {
                tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
            }

            $(messageViewerManager.table.find("tbody").empty()).append(tbody);
            // todo adjust scroll offset appropriately!

            var thumbPos = scrollbarManager.getThumbPosition();

            scrollbarManager.redraw(newDataset, activeSchemeId);
            scrollbarManager.redrawThumb(thumbPos);
        }
        console.timeEnd("sort");
    },

    restorePreviousPosition: function() {

        let tbody = "";
        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < messageViewerManager.lastLoadedPageIndex * halfPage + halfPage; i++) {
            tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
        }

        $(messageViewerManager.table.find("tbody").empty()).append(tbody);
        // todo adjust scroll offset appropriately!

        scrollbarManager.redraw(newDataset, this.activeScheme);

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

            //let triangleIcon = "<a href='#' class='sort-button'><small><span class='glyphicon glyphicon-sort-by-order'></span></small></a>";
            let triangleIcon = "<a href='#' class='sort-button'><small><span class='glyphicon glyphicon-sort'></span></small></a>";
            let editButton = "<button type='button' class='btn btn-default btn-xs edit-scheme-button'><i class='glyphicon glyphicon-edit'></i></button>";
            let columnDiv = "<div class='col-md-" + decoColumnWidth + " scheme-col' scheme='" + schemeKey + "'>" + triangleIcon + "<i class='scheme-name'>" + schemes[schemeKey]["name"] + "</i>" + editButton + "</div>";


            var decoColumn = $("#header-decoration-column");
            var appendedElements = $(columnDiv).appendTo(decoColumn.find(".row"));

            if (i==0) {
                activeSchemeId = schemeKey;
                messageViewerManager.activeScheme = activeSchemeId;
                $(appendedElements).children("i").css("text-decoration", "underline");
            }
            $(appendedElements).children("i").on("click", messageViewerManager.changeActiveScheme);
            bindEditSchemeButtonListener(appendedElements.children("button"), schemes[schemeKey]);
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

        for (let i = 0; i < rowsPerPage; i++) {
            tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
        }

        messageViewerManager.table.find("tbody").append(tbody);

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

            }

        });

    },

    recodeEvents : function() {
        regexMatcher.codeDataset(activeSchemeId);
        let halfPage = Math.floor(messageViewerManager.rowsInTable/2);
        let visibleRange = [(messageViewerManager.lastLoadedPageIndex-1) * halfPage, messageViewerManager.lastLoadedPageIndex * halfPage + halfPage];

        for (let i = visibleRange[0]; i < visibleRange[1]; i++) {
            let eventObj = newDataset.events[i];
            let code = eventObj.codeForScheme(activeSchemeId);
            if (code != null) {
                console.log("code");
                $(".message[eventid='" + i + "']").find("p").html(regexMatcher.wrapText(newDataset.events[i].data, regexMatcher.generateOrRegex(code.words), "highlight", code.id));
                let selectObj = $(".message[eventid='" + eventObj.name + "']").find("select."+ activeSchemeId).val(code["value"]).removeClass("uncoded").addClass("coded");

                this.dropdownChangeHandler(selectObj, false);
            }


        }



    },

    changeActiveScheme : function() {

        $("#header-decoration-column").find("i").not(".glyphicon").css("text-decoration", "");
        $(this).css("text-decoration", "underline");
        activeSchemeId = $(this).parents("div.scheme-col").attr("scheme");
        messageViewerManager.activeScheme = activeSchemeId;

        var schemeObj = schemes[activeSchemeId];

        let thumbPos = scrollbarManager.getThumbPosition();
        scrollbarManager.redraw(newDataset, activeSchemeId);
        scrollbarManager.redrawThumb(thumbPos);

        // todo think about whether inactive select should be disabled or just greyed out!
        // TODO: INDICATE WHICH SORTING IS ACTIVE.... !!!!


        $(".message").each(function(i, tr) {
            // find code object via selected option
            let selectFields = $(tr).find("select." + activeSchemeId);
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
        });

    },

    dropdownChangeHandler: function(selectElement, manual) {

        if (manual == undefined) manual = true;
        if (/form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class")) == null) {
            console.log("was ist das");
        }

        var schemeId = /form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))[1];
        let value = selectElement.val();
        let row = selectElement.parents(".message");
        let sessionId = $(row).attr("sessionid");
        let eventId = $(row).attr("eventid");

        var eventObj = newDataset.events[eventId];
        var codeObj = schemes[schemeId].getCodeByValue(value);

        if (value.length > 0) {

            // add decoration
            let decoration = eventObj.decorationForName(schemeId);
            if (decoration === undefined) {
                eventObj.decorate(schemeId, manual, schemes[schemeId].getCodeByValue(value));
            } else {
                decoration.code = schemes[schemeId].getCodeByValue(value);
                decoration.manual = manual;
                decoration.confidence = 0.95;
                decoration.code.addEvent(eventObj);
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

                codeObj.addWords(Object.keys(messageViewerManager.wordBuffer[sessionId][eventId]));
                messageViewerManager.wordBuffer[sessionId][eventId] = {}
            }

            regexMatcher.wrapElement(eventObj, regexMatcher.generateOrRegex(codeObj.words), codeObj.id);


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

        if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
            newDataset.sortEventsByConfidenceOnly(schemeId);
        }
        if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByScheme) {
            newDataset.sortEventsByScheme(schemeId, true);
        }
        if (messageViewerManager.currentSort == messageViewerManager.sortUtils.restoreDefaultSort) {
            newDataset.restoreDefaultSort();
        }

        let tbody = "";
        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);

        let iterationStop = messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.events.length ? newDataset.events.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;

        for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < iterationStop; i++) {
            tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
        }

        $(messageViewerManager.table.find("tbody").empty()).append(tbody);
        // todo adjust scroll offset appropriately!

        var thumbPos = scrollbarManager.getThumbPosition();

        scrollbarManager.redraw(newDataset, activeSchemeId);
        scrollbarManager.redrawThumb(thumbPos);

    },

    dropdownChange : function(event, manual) {

        let selectElement = $(event.target);
        messageViewerManager.dropdownChangeHandler(selectElement, manual);
    },

    addNewSchemeColumn: function(scheme) {

        // TODO: warning message in case of empty codes
        if (scheme["codes"].size === 0) return;

        var decorationCell = $("#header-decoration-column").find(".row");
        var decoNumber = Object.keys(schemes).length;
        var newDecoColumnWidth = (12/decoNumber>>0);
        /*
         Restructure the header
         */

        var div = ($("<div class='col-md-" + newDecoColumnWidth + " scheme-col' scheme='" + scheme["id"] + "'>" +
            "<a href='#' class='sort-button'><small><span class='glyphicon glyphicon-sort'></span></small></a>" +
            "<i class='scheme-name'>" + scheme["name"] + "</i>" +
            "<button type='button' class='btn btn-default btn-xs edit-scheme-button'><i class='glyphicon glyphicon-edit'></i></button>" +
            "</div>")).appendTo(decorationCell);

        div.find("i.scheme-name").on("click", this.changeActiveScheme);
        div.find("i.scheme-name").trigger("click");
        this.bindEditSchemeButtonListener(div.find("button"), scheme);

        decorationCell.children("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth + ' scheme-col');

        let sortButton = $("a");
        sortButton.off("click");
        sortButton.on("click", messageViewerManager.sortHandler);

        // TODO: sort the data to default order first??? or keep it?

        regexMatcher.codeDataset(tempScheme["id"]);

        let tbody = "";
        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        for (let i = 0; i < messageViewerManager.rowsInTable; i++) {
            tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
        }

        this.lastLoadedPageIndex = 1; // todo store which page was loaded

        var tbodyObj = this.table.find("tbody");
        tbodyObj.empty();
        tbodyObj.append(tbody);
        this.messageContainer.scrollTop(0);

        // Move active row back to top because nothing will have been coded yet
        activeRow.removeClass("active");
        activeRow = $(".message").first().addClass("active");

    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");
        var schemeId = scheme.id;
        $(editButton).on("click", function() {

            //let schemeId = $(this).parent().attr("scheme");
            scheme = schemes[schemeId];
            tempScheme = CodeScheme.clone(scheme);

            if (!(codeEditor.is(":visible"))) {

                let selectedOptionId = activeRow.find("option[selected]");

                editorOpen = true;
                let values = Array.from(tempScheme.codes.values()); // todo rewrite to use iterator
                values.forEach(function (codeObj) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], codeObj["id"], codeObj["words"]);
                });

                codeEditorManager.bindSaveEditListener();

                $("#scheme-name-input").val(scheme["name"]);

                codeEditor.show();


                // need to update code panel after editor is displayed so that the width is set correctly!
                codeEditorManager.updateCodePanel(values[values.length-1]);

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

                    newDataset.events[eventId].decorate(codeObj.owner["id"], true, codeObj, 0.95);

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

        var tbody = "";

        /*
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
        */

        const halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (index * halfPage + halfPage > newDataset.events.length) ? newDataset.events.length : index * halfPage + halfPage;

        for (let i = index * halfPage; i < stoppingCondition; i++) {
            tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
        }

       return tbody;


    },

    infiniteScroll : function(event) {

        // todo: fix bug with scrolling to the bottom!!!!!!!! :o :o :o :o :o :o

        let currentY = messageViewerManager.messageContainer.scrollTop();
        if (currentY === messageViewerManager.lastTableY || messageViewerManager.isProgramaticallyScrolling) {
            return;
        }

        if (currentY > messageViewerManager.lastTableY && UIUtils.isScrolledToBottom(messageViewerManager.messageContainer)) {
            console.time("infinite scroll DOWN");

            let nextPage = messageViewerManager.lastLoadedPageIndex + 1;

            if (nextPage <= Math.floor(newDataset.events.length / Math.floor(messageViewerManager.rowsInTable/2)) - 1) {

                messageViewerManager.lastLoadedPageIndex = nextPage;

                let tbody = "";
                let halfPage = Math.floor(messageViewerManager.rowsInTable/2);
                let stoppingCondition = nextPage * halfPage + halfPage > newDataset.events.length ? newDataset.events.length : nextPage * halfPage + halfPage;
                for (let i = nextPage * halfPage; i < stoppingCondition; i++) {
                    tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
                }

                let tbodyElement = messageViewerManager.table.find("tbody");
                let lastMessage = $(".message").last();
                let lastMessagePosition = lastMessage.position().top;

                let elementsToRemove = tbodyElement.find("tr:nth-child(-n+" + Math.floor(messageViewerManager.rowsInTable/2) + ")");
                elementsToRemove.remove();
                tbodyElement.append(tbody);
                console.log("new page added");

                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.messageContainer.scrollTop($("#message-panel").scrollTop() + (-1 * (lastMessagePosition - lastMessage.position().top)));
                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
                messageViewerManager.isProgramaticallyScrolling = false;
                //scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);

                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redrawThumb(thumbPos);

                console.timeEnd("infinite scroll DOWN");
            }

        } else if (currentY < messageViewerManager.lastTableY && UIUtils.isScrolledToTop(messageViewerManager.messageContainer)){

            if (messageViewerManager.lastLoadedPageIndex !== 1 ) {
                console.time("infinite scroll UP");

                var prevPage = messageViewerManager.lastLoadedPageIndex - 2;
                messageViewerManager.lastLoadedPageIndex--;
                let firstRow = $(".message").first();
                let originalOffset = firstRow.position().top;

                let tbody = "";

                let halfPage = Math.floor(messageViewerManager.rowsInTable/2);
                let stoppingCondition = prevPage * halfPage + halfPage;
                for (let i = prevPage * halfPage; i < stoppingCondition; i++) {
                    tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
                }

                let tbodyElement = messageViewerManager.table.find("tbody");
                tbodyElement.find("tr:nth-last-child(-n+" + Math.floor(messageViewerManager.rowsInTable)/2 + ")").remove();
                tbodyElement.prepend(tbody);

                // adjust scrollTop of the panel so that the previous top row stays on top of the table (and not out of view)
                let newOffset = firstRow.position().top;
                messageViewerManager.isProgramaticallyScrolling = true;
                messageViewerManager.messageContainer.scrollTop(messageViewerManager.messageContainer.scrollTop()+ (-1 * (originalOffset - newOffset)));
                messageViewerManager.lastTableY = messageViewerManager.messageContainer.scrollTop();
                messageViewerManager.isProgramaticallyScrolling = false;


                let thumbPos = scrollbarManager.getThumbPosition();
                scrollbarManager.redrawThumb(thumbPos);
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
        var eventText = eventObj["data"];

        // need to check if eventObj has a 'stale' decoration
        // need to perform null checks for code! if event isn't coded yet it has a null code.
        if ( activeDecoration != undefined && activeDecoration.code !== null) {
            var parentSchemeCodes = activeDecoration.code.owner.codes;
            if (!parentSchemeCodes.has(activeDecoration.code.id)) {
                // in case the event object is still coded with a code that doesn't exist in the scheme anymore
                eventObj.uglify(activeDecoration.scheme_id);

            } else if (activeDecoration.code.color !== undefined) {
                rowColor = activeDecoration.code.color;
            }

            eventText = regexMatcher.wrapText(eventObj["data"], regexMatcher.generateOrRegex(activeDecoration.code.words), "highlight", activeDecoration.code.id);
        }



        sessionRow += "<tr class='message' id=" + eventObj["name"] + " eventId = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";
        //sessionRow += "<td class='col-md-2' style='background-color: " + rowColor+ "'>" + eventObj["timestamp"] + "</td>";
        sessionRow += "<td class='col-md-2' style='background-color: " + rowColor+ "'>" + eventObj["name"] + "</td>";

        //sessionRow += "<td class='col-md-4 message-text' style='background-color: " + rowColor+ "'><p>" + eventObj["data"] + "</p></td>";
        //sessionRow += "<td class='col-md-4 message-text' style='background-color: " + rowColor+ "'><p>" + eventObj["data"] + "</p></td>";
        sessionRow += "<td class='col-md-4 message-text' style='background-color: " + rowColor+ "'><p>" + eventText + "</p></td>";
        sessionRow += "<td class='col-md-4 decorations' style='background-color: " + rowColor+ "'>";
        sessionRow += "<div class='row decorator-column'>";

        messageViewerManager.codeSchemeOrder.forEach(function(schemeKey) {

            var codes = Array.from(newDataset.schemes[schemeKey].codes.values());
            sessionRow += "<div class='col-md-" + decoColumnWidth + " deco-container' scheme='" + schemeKey + "'>";
            var optionsString = "";
            var selectClass = "uncoded";
            var somethingSelected = false;
            var schemeKey = schemeKey + "";

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
            var sessionId = $(element).closest('tr').attr("sessionid");
            var eventId = $(element).closest('tr').attr("eventid");

            if (window.getSelection && window.getSelection() && window.getSelection().toString().length > 0) {

                var selection = window.getSelection().toString(); // todo do we preprocess this in any way?
                console.log(selection);

                // check if current row has an assigned code and if yes, add the words to the data structure
                // todo FIX THIS - check in data structure

                const code = newDataset.events[eventId].codeForScheme(messageViewerManager.activeScheme);
                const isCoded = code!=undefined;

                if (isCoded) {

                    let regex = regexMatcher.generateOrRegex(UIUtils.concatArraysUniqueWithSort(code.words, [selection]));
                    code.addWords([selection]);
                    $(".message[eventid='" + eventId + "']").find("p").html(regexMatcher.wrapText(newDataset.events[eventId].data, regex, "highlight", code.id));

                    if (selection.length > 0) regexMatcher.wrapElement(newDataset.events[eventId].data, new RegExp(selection, "ig"), code.id);
                    //schemes[messageViewerManager.activeScheme].getCodeByValue(selectElement.val()).words = words;

                } else {
                    let regex = regexMatcher.generateOrRegex([selection]);
                    $(".message[eventid='" + eventId + "']").find("p").html(regexMatcher.wrapText(newDataset.events[eventId].data, regex, "highlight"));


                    if (messageViewerManager.wordBuffer[sessionId][eventId][selection]!= 1) {
                        messageViewerManager.wordBuffer[sessionId][eventId][selection] = 1;
                    }
                }
            }
        }
    },
};