var messageViewerManager = {
    messageContainer: {},
    table: {},
    codeSchemeOrder: [],

    init: function(messageContainer, data) {
        this.messageContainer = messageContainer;
        this.table = messageContainer.find("table");
        this.buildTable(data);
    },

    buildTable: function(data) {
        var schemes = newDataset.schemes;

        /*
        Object.keys(state.schemes).forEach(function(schemeName) {
           schemes.push(state.schemes[schemeName]);
        });
        */

        var decoNumber = Object.keys(schemes).length;
        var decoColumnWidth = (12/decoNumber>>0);
        var bindEditSchemeButtonListener = this.bindEditSchemeButtonListener;
        var messagePanel = this.messageContainer;

        /*
        Build header
         */
        Object.keys(schemes).forEach(function(schemeKey) {

            messageViewerManager.codeSchemeOrder.push(schemeKey);

            var decoColumn = $("#header-decoration-column");
            var col = $("<div class='col-md-" + decoColumnWidth + "' id = 'header" + schemeKey + "'><i>" + schemes[schemeKey]["name"] + "</i></div>").appendTo(decoColumn.find(".row"));

            var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
                "<i class='glyphicon glyphicon-edit'>" +
                "</i>" +
                "</button>").appendTo(col);

            bindEditSchemeButtonListener(button, schemes[schemeKey]);
        });



        /*
        Build rows
         */

        newDataset.sessions.forEach(function(session) {
            var events = session.events;
            events.forEach(function(event) {
                var eventRow = $("<tr class='message' id=" + event["name"] + "></tr>").appendTo("#message-table > tbody");
                eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>");
                eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");
                var decoColumn = $("<td class=col-md-4></td>").appendTo(eventRow);
                var decoCell =  $("<div class='row decorator-column'></div>").appendTo(decoColumn);


                //$("<td class=col-md-4><div class='row'></div></td>").appendTo(decoCell);

                /*if (state.schemes[state.activeCell["decoName"]]["colors"].length > 0) {

                }*/

                Object.keys(newDataset.schemes).forEach(function(schemeKey, index) {
                    var codes = newDataset.schemes[schemeKey].codes;


                   /*
                    if (!schemes.hasOwnProperty(decoration)) {
                        schemes[decoration] = [];
                    }

                    if (schemes[decoration].indexOf(event["decorations"][decoration]) === -1) {
                        schemes[decoration].push(event["decorations"][decoration]);
                    }
                    */

                    var div = $("<div class='col-md-" + decoColumnWidth + "'></div>").appendTo(decoCell);
                    var input = $("<select class='form-control " + schemeKey + "'></select>").appendTo(div);

                    //var currentScheme = schemes.filter(function(scheme) {return scheme["name"] === decoration;})[0];

                    codes.forEach(function(code, i) {
                        input.append("<option>" + code["value"] + "</option>");


                        if (index == 0) {
                            eventRow.children("td").each(function(i, td) {
                                $(td).css("background-color", code["color"]);
                            });
                        }

                    });

                    if (event["decorations"].has(schemes[schemeKey]["name"])) {
                        input.val(event["decorations"].get(schemes[schemeKey]["name"]).value);
                    } else {
                        input.val("");
                        eventRow.addClass("uncoded");
                    }


/*
                    currentScheme["codes"].forEach(function(code, j) {
                       input.append("<option>" + code + "</option>");

                        if (index == state.activeCell["index"]) {
                            eventRow.children("td").each(function(i, td) {
                                var codeIndex = state.schemes[state.activeCell["decoName"]]["codes"].indexOf(event["decorations"][decoration]);
                                $(td).css("background-color", state.schemes[state.activeCell["decoName"]]["colors"][codeIndex]);
                            });
                        }

                    });
**/
/*
                    input.val(event["decorations"][decoration]);
                    if (event["decorations"][decoration].length === 0) {
                        eventRow.addClass("uncoded");
                    }
*/



                });
            });
        });


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
                activeRow = UIUtils.nextUnfilledRow(activeRow, true);
                activeRow.toggleClass("active");


                var isVisible = UIUtils.isRowVisible(activeRow[0], messagePanel[0]);

                if (!isVisible) {
                    UIUtils.scrollRowToTop(activeRow[0], messagePanel[0]);
                }
            }

        });

    },

    addNewScheme: function(scheme) {

        // TODO: warning message in case of empty codes
        if (scheme["codes"].length === 0) return;


        var decorationCell = $("#header-decoration-column").find(".row");
        var numberOfDecorations = decorationCell.find("div[class*=col-]").length + 1;
        var newDecoColumnWidth = (12/numberOfDecorations>>0);

        var div = ($("<div class='col-md-" + newDecoColumnWidth + "'><i>" + scheme["name"] + "</i></div>")).appendTo(decorationCell);
        var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
        "<i class='glyphicon glyphicon-edit'>" +
        "</i>" +
        "</button>").appendTo(div);

        this.bindEditSchemeButtonListener(button, scheme);

        decorationCell.find("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth);

        this.table.find("tbody > tr").each(function(index, row) {
            var decoCell = $(row).children("td:last").find(".row");

            // keep it a div instead of td so styles dont conflict
            var div = $("<div class='col-md-" + newDecoColumnWidth + "'></div>").appendTo(decoCell);
            var input = $("<select class='form-control'></select>").appendTo(div);

            scheme["codes"].forEach(function(code) {
                input.append("<option>" + code + "</option>");
            });
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
/*
                scheme["codes"].forEach(function(code, index) {
                    codeEditorManager.addCodeInputRow(code, "", scheme["colors"][index]);
                });
*/
                Array.from(tempScheme.codes.values()).forEach(function (codeObj, index) {
                    codeEditorManager.addCodeInputRow(codeObj["value"], codeObj["shortcut"], codeObj["color"], index);
                });


                var index;
                $(this).closest(".row").find("div").each(function(i, columnDiv) {
                    if ($(columnDiv).text() === scheme["name"])
                        index = i;
                });

                codeEditorManager.bindSaveEditListener(messageViewerManager.codeSchemeOrder.indexOf(scheme["id"]));

                $("#scheme-name-input").val(scheme["name"]);
                codeEditor.show();
            }
        });
    }
};
