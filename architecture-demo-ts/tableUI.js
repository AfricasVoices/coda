var messageViewerManager = {
    messageContainer: {},
    table: {},
    codeSchemeOrder: [],

    init: function(messageContainer, data) {
        this.messageContainer = messageContainer;
        this.table = messageContainer.find("table");
        this.buildTable(data);
        var dropdowns = $(".decorator-column").find("select");
        dropdowns.each(function(i, dropdown) {
            $(dropdown).on("change", messageViewerManager.dropdownChange);
        });
    },

    buildTable: function(data) {
        var schemes = newDataset.schemes;
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
                activeScheme = schemeKey;
                col.children("i").css("text-decoration", "underline");
            }
            col.children("i").on("click", messageViewerManager.changeActiveScheme);
            bindEditSchemeButtonListener(button, schemes[schemeKey]);
        });



        /*
        Build rows
         */

        newDataset.sessions.forEach(function(session) {
            session.events.forEach(function(event) {
                var eventRow = $("<tr class='message' id=" + event["name"] + "></tr>").appendTo("#message-table > tbody");
                eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>");
                eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");
                var decoColumn = $("<td class=col-md-4></td>").appendTo(eventRow);
                var decoCell =  $("<div class='row decorator-column'></div>").appendTo(decoColumn);


                Object.keys(newDataset.schemes).forEach(function(schemeKey, index) {
                    var codes = Array.from(newDataset.schemes[schemeKey].codes.values());
                    var div = $("<div class='col-md-" + decoColumnWidth + "'></div>").appendTo(decoCell);
                    var input = $("<select class='form-control " + schemeKey + " coded'></select>").appendTo(div);

                    codes.forEach(function(codeObj) {
                        input.append("<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>");

                        if (index == 0) {
                            eventRow.children("td").each(function(i, td) {
                                $(td).css("background-color", codeObj["color"]);
                            });
                        }

                    });

                    input.append("<option class='unassign'></option>"); // in order to be able to unassign codes

                    if (event["decorations"].has(schemes[schemeKey]["name"])) {
                        input.val(event["decorations"].get(schemes[schemeKey]["name"]).value);
                    } else {
                        input.val("");
                        input.removeClass("coded");
                        input.addClass("uncoded");
                    }
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

    changeActiveScheme : function() {

        $("#header-decoration-column").find("i").not(".glyphicon").css("text-decoration", "");
        $(this).css("text-decoration", "underline");
        activeScheme = /header(.*)/.exec($(this).parents("div").attr("id"))[1];

        var schemeObj = schemes[activeScheme];
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
            var selectedOption = $(tr).find("select." + activeScheme).find("option:selected").not(".unassign");

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

    dropdownChange : function() {

        var schemeId = /form-control (.*) (uncoded|coded)/.exec($(this).attr("class"))[1];
        var value = $(this).val();
        var row = $(this).parents(".message");

        if (value.length > 0) {
            $(this).removeClass("uncoded");
            $(this).addClass("coded");

            if (activeScheme === schemeId) {
                var color = schemes[schemeId].getCodeByValue(value)["color"];
                row.children("td").each(function(i, td) {
                    $(td).css("background-color", color);
                });
            }

        } else {
            $(this).removeClass("coded");
            $(this).addClass("uncoded");

            if (activeScheme === schemeId) {
                row.children("td").each(function (i, td) {
                    $(td).css("background-color", "#ffffff");
                });
            }
        }

    },

    addNewSchemeColumn: function(scheme) {

        // TODO: warning message in case of empty codes
        if (scheme["codes"].size === 0) return;


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
    }
};
