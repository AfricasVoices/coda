var messageViewerManager = {
    messageContainer: {},
    table: {},
    codeSchemeOrder: [],
    tablePages: [],
    rowsPerPage : 0,
    currentlyLoadedPages : [],

    init: function(messageContainer, data, rowsPerPage) {

        if (rowsPerPage === undefined) rowsPerPage = 20;
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

        $("#message-panel").scroll(function(event) {
            console.log("scroll height: " + $("#message-table")[0].scrollHeight + ", scroll top: " + $("#message-panel").scrollTop() +  ", outer height: " + $("#message-panel").outerHeight(false));
            messageViewerManager.infiniteScroll(event);
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
            var col = $("<div class='col-md-" + decoColumnWidth + "' id = 'header" + schemeKey + "'><i>" + schemes[schemeKey]["name"] + "</i></div>").appendTo(decoColumn.find(".row"));

            var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
                "<i class='glyphicon glyphicon-edit'>" +
                "</i>" +
                "</button>").appendTo(col);

            if (i==0) {
                activeSchemeId = schemeKey;
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
        newDataset.sessions.forEach(function(session, sessionIndex) {
            session.events.forEach(function(event, eventIndex) {

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

        /*
        ACTIVE ROW HANDLING
        */

        // init
        activeRow = this.table.find("tbody").find("tr:first");
        activeRow.toggleClass("active");


        // click select
        this.table.on('click', 'tbody tr', function() {
            $(this).addClass('active').siblings().removeClass('active');
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
                activeRow = UIUtils.nextUnfilledRow(activeRow, true, activeSchemeId);
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
        activeSchemeId = /header(.*)/.exec($(this).parents("div").attr("id"))[1];

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

        $(".message").each(function(i, tr) {
            // find code object via selected option
            var selectedOption = $(tr).find("select." + activeSchemeId).find("option:selected").not(".unassign");

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

        });

    },

    dropdownChange : function(event) {

        var selectElement = $(event.target);

        var schemeId = /form-control (.*) (uncoded|coded)/.exec(selectElement.attr("class"))[1];
        var value = selectElement.val();
        var row = selectElement.parents(".message");

        var eventObj = newDataset.sessions[$(row).attr("sessionid")]["events"][$(row).attr("eventid")];

        if (value.length > 0) {

            // update data structure
            var decoration = eventObj.decorationForName("schemeId");
            if (decoration === undefined) {
                eventObj.decorate(schemes[schemeId]["name"], schemes[schemeId]["codes"].get(selectElement.attr("id")));
            } else {
                decoration.code = schemes[schemeId]["codes"].get(selectElement.attr("id"));
            }

            selectElement.removeClass("uncoded");
            selectElement.addClass("coded");

            if (activeSchemeId === schemeId) {
                var color = schemes[schemeId].getCodeByValue(value)["color"];
                row.children("td").each(function(i, td) {
                    $(td).css("background-color", color);
                });
            }

        } else {

            // remove code from event in data structure
            eventObj.uglify(schemes[schemeId]["name"]);


            selectElement.removeClass("coded");
            selectElement.addClass("uncoded");

            if (activeSchemeId === schemeId) {
                row.children("td").each(function (i, td) {
                    $(td).css("background-color", "#ffffff");
                });
            }
        }

    },

    addNewSchemeColumn: function(scheme) {

        // TODO: warning message in case of empty codes
        if (scheme["codes"].size === 0) return;


        /*
        Add decorations to datastructure
         */
        // TODO: happens already, move here


        var decorationCell = $("#header-decoration-column").find(".row");
        var numberOfDecorations = decorationCell.find("div[class*=col-]").length + 1;
        var newDecoColumnWidth = (12/numberOfDecorations>>0);

        /*
        Restructure the header
         */

        var div = ($("<div class='col-md-" + newDecoColumnWidth + "' id='header" + scheme["id"] + "'><i>" + scheme["name"] + "</i></div>")).appendTo(decorationCell);
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

    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");

        $(editButton).on("click", function() {

            var schemeId = /header(.*)/.exec($(this).parent().attr("id"))[1];
            scheme = schemes[schemeId];
            tempScheme = CodeScheme.clone(scheme);

            if (!(codeEditor.is(":visible"))) {

                editorOpen = true;

                Array.from(tempScheme.codes.values()).forEach(function (codeObj, index) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], codeObj["id"]);
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

            var shortcuts = schemes[activeSchemeId].getShortcuts();
            if (shortcuts.has(event.keyCode)) {
                var codeObj = shortcuts.get(event.keyCode);
                $(activeRow).children("td").each(function(i, td) {
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

                //var next = activeRow.next();
                var next = UIUtils.nextUnfilledRow(activeRow, true, activeSchemeId);
                if (next.length !== 0) {
                    activeRow.removeClass('active');
                    //activeRow = activeRow.next().addClass('active');
                    activeRow = next.addClass('active');

                    if (!UIUtils.isRowVisible(next[0], messageViewerManager.messageContainer[0])) {
                        UIUtils.scrollRowToTop(next[0], messageViewerManager.messageContainer[0]);
                    }

                }
            }
        }
    },

    infiniteScroll : function(event) {
        if (UIUtils.isScrolledToBottom(messageViewerManager.messageContainer)) {
            console.time("infinite scroll DOWN");

            var nextPage = messageViewerManager.currentlyLoadedPages[messageViewerManager.currentlyLoadedPages.length-1] + 1;
            messageViewerManager.currentlyLoadedPages.push(nextPage);

            var tbody = "";
            var sessions = newDataset.sessions;
            var startOfPage = messageViewerManager.tablePages[nextPage].start;
            var endOfPage = messageViewerManager.tablePages[nextPage].end;

            for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
                var events = sessions[i];
                for (var j = 0; j <= endOfPage[1]; j++) {
                    if (i === startOfPage[0] && j < startOfPage[1]) continue;
                    else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], i, j);
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

            newScrollTop >= 0 ? $("#message-panel").scrollTop(newScrollTop) : $("#message-panel").scrollTop(0);
            console.timeEnd("infinite scroll DOWN");


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
                        else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], i, j);
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

        sessionRow += "<tr class='message' id=" + eventObj["name"] + " eventId = '" + eventIndex + "' sessionId = '" + sessionIndex + "'>";
        sessionRow += "<td class='col-md-2'>" + eventObj["timestamp"] + "</td>";
        sessionRow += "<td class=col-md-4>" + eventObj["data"] + "</td>";
        sessionRow += "<td class=col-md-4>";
        sessionRow += "<div class='row decorator-column'>";

        Object.keys(newDataset.schemes).forEach(function(schemeKey) {

            var codes = Array.from(newDataset.schemes[schemeKey].codes.values());
            sessionRow += "<div class='col-md-" + decoColumnWidth + "'>";

            var selected = eventObj["decorations"].get(schemes[schemeKey]["name"]).code;
            var optionsString = "";
            var selectClass = "uncoded";

            codes.forEach(function(codeObj) {

                if (eventObj["decorations"].has(schemes[schemeKey]["name"])) {
                    if (eventObj["decorations"].get(schemes[schemeKey]["name"]).code === codeObj["value"]) {
                        optionsString += "<option id='" + codeObj["id"] + "' selected>" + codeObj["value"] + "</option>";
                        selectClass = "coded";
                    } else {
                        optionsString += "<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>";
                    }
                }

            });

            sessionRow += "<select class='form-control " + schemeKey + " " + selectClass + "'>";
            sessionRow += optionsString;

            sessionRow += "<option class='unassign'></option>";
            sessionRow += "</select>";
            sessionRow += "</div>";

        });

        sessionRow += "</div>";
        sessionRow += "</td>";
        sessionRow += "</td>";
        sessionRow += "</tr>";

        return sessionRow;
    }

};
