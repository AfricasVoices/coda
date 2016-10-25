/**
 * Created by fletna on 16/09/16.
 */
var eventDecoOrder = [];
var eventDecoLabels = {};
var dataset;

function saveJSON(url) {
    var eventList = {};
    d3.select('tbody').selectAll("tr").each(function(tr,j){
        //var eventsNum = $("tr[session-id='" + d3.select(this).attr("session-id") + "']").length;
        //for (i=0; i<eventsNum; i++) {
            dataset[d3.select(this).attr("session-id")]["events"][d3.select(this).attr("event-index")]["decorations"]["type"] = $($(this).children()[3]).children(".selection").children(".text").text();
        //}
    });


    d3.json(url, function(error,data) {
        return data;
    })
        .header("Content-Type","application/json")
        .send("POST", JSON.stringify(dataset))
}

d3.json("../models/sessions.json", function(data) {

    dataset = data;

    var dataHeaderLabels = ["session_id", "timestamp", "data"];
    var codeHeaderLabels = [];
    var event = data[Object.keys(data)[0]]["events"][0];

    Object.keys(event["decorations"]).forEach(function(decoKey) {
        codeHeaderLabels.push(decoKey);
        eventDecoOrder.push(decoKey);//if (eventDecoOrder.indexOf(decoKey) === -1) eventDecoOrder.push(decoKey);
        eventDecoLabels[decoKey] = [];//if (!eventDecoLabels.hasOwnProperty(decoKey)) eventDecoLabels[decoKey] = [];
    });

    codeHeaderLabels.push("");

    Object.keys(data).forEach(function(key) { extractLabels(data[key]);});

    var flattenSession = function(session) {
        var flat = [];
        session["events"].forEach(function(event,i) {
            if (i<5) {
                flat.push(event["timestamp"]);
                flat.push(event["data"]);
                Object.keys(event["decorations"]).forEach(function(deco,j) {
                    flat.push(event["decorations"][eventDecoOrder[j]]);
                })
            }
        });
        return flat;
    }

    function extractLabels(session) {
        Object.keys(session["events"]).forEach(function(eventKey) {
            var event = session["events"][eventKey];
            Object.keys(event["decorations"]).forEach(function(decorationKey) {
                if (eventDecoLabels[decorationKey].indexOf(event["decorations"][decorationKey]) === -1)
                    eventDecoLabels[decorationKey].push(event["decorations"][decorationKey]);
            });
        });
    }

    function createEventRows(sessionKeys) {
        var rows = [];
        sessionKeys.forEach(function(sessionKey){
            var session = data[sessionKey]
            data[sessionKey]["events"].forEach(function(event,i) {
                var eventObj = {}
                if (i<5) {
                    eventObj["session"] = i === 0 ? sessionKey : "";
                    eventObj["timestamp"] = event["timestamp"];
                    eventObj["data"] = event["data"];
                    eventDecoOrder.forEach(function(deco) {
                        eventObj[deco] = event["decorations"][deco];
                    });

                    eventObj.__sessionID__ = sessionKey;
                    eventObj.__eventIndex__ = i;
                    rows.push(eventObj);
                }
            });

        });

        return rows;
    }


    /*
        Structure
     */

    var table = d3.select("#table-container").append("table")
        .attr("class", "ui selectable celled table")
        .append("thead").append("tr");

    var header = table.selectAll("th").data(dataHeaderLabels).enter()
        .append("th")
        .text(function (d) {return d})
        .attr("class", "data header");

    var allHeaders = dataHeaderLabels.concat(codeHeaderLabels);
    table.selectAll("th").data(allHeaders).enter()
        .append("th")
        .text(function (d) {return d})
        .attr("class", function(el, i) {
            var className;
            i == allHeaders.length-1 ? className = "extra header": className = "code header";
            return className;
        });

    d3.select(".extra.header").append("button").attr("class", "ui icon button").append("i").attr("class", "plus icon");

    var body = d3.select("table").append("tbody")
        .selectAll("tr").data(createEventRows(Object.keys(data))).enter()
        .append("tr")
            .attr("session-id", function(row) {return row.__sessionID__;})
            .attr("event-index", function(row,i) {return row.__eventIndex__;})
            .attr("row", function(row,i) {return i;})
        .selectAll("td").data(function (sessionData) {
            var trueKeys = Object.keys(sessionData).filter(key => !key.endsWith("_"));
            return trueKeys.map(key => [sessionData[key], sessionData.__sessionID__]);
        }).enter()
        .append("td")
            .attr("id", function(cell,i) {return cell[1] + "-" + allHeaders[i] + "-" + i;})
            .attr("class", function(cell,i) {return "data cell " + allHeaders[i];})
            .each(function (cell, i) {
                if (eventDecoOrder.indexOf(allHeaders[i]) ===-1) {
                    d3.select(this).text(cell[0])
                        .attr("empty", cell[0] === "" ? "" : null)
                        .attr("full", cell[0] !== "" ? "" : null);
                } else {
                    d3.select(this).append("select")
                        .attr("class", "ui search dropdown")
                        .selectAll("option").data(eventDecoLabels[allHeaders[i]]).enter()
                        .append("option")
                        .attr("value", function (d) { return d; })
                        .text(function (d) { return d; })
                        .attr("picked", function(d) {
                            return cell[0] === d ? "" : null;});
                }
        });

    d3.select("tbody").selectAll("tr").append("td").attr("class","extra cell");

    d3.selectAll("option[picked]").each(function() {
        var currentPicked = this;
        $(this).parents("select").dropdown("set selected", $(this).attr("value"));
    });
    //d3.selectAll("td[empty]").each(function() {d3.select(this).attr("class","warning");})
    d3.selectAll("td[full]").each(function(empty,i) {
        (+$(this).parents("tr").attr("session-id") % 2) == 0 ? d3.select(this).attr("class","negative") : d3.select(this).attr("class","positive");
    });

    /*
        Interaction
     */

    /*
    $(".extra").on("click", function(cell) {
       // open editor
        var popup = window.open("", "", "width=480,height=480,resizeable,scrollbars"),
            table = document.getElementById("editor"),
            head = document.getElementsByTagName("head")[0],
            script = document.createElement("script");

        script.src = "/javascripts/editorUI.js";

        popup.document.write(head.outerHTML);
       //popup.document.write(table.outerHTML);
        popup.document.write(script.outerHTML);
        popup.document.close();
        if (window.focus)
            popup.focus();
    });
    */

    $("#add-code").on("click", function() {
        addCodeRow("");
    });

    $(".extra").on("click", function(cell) {
        $("#editor").find("tbody").find("tr").remove();
        $('.modal')
            .modal('show');
    });

    $("#save").on("click", function(event){
        var newCodeContainers = $("#editor > tbody").find("tr").find(".code").find("input");
        var codes = []
        newCodeContainers.each(function(index,code) {
            codes.push($(code).attr("value"));
        });

        eventDecoLabels[$(".modal").attr("id")] = codes;

        $(".cell." + $(".modal").attr("id")).find("select").append("<option>" + $(".modal").attr("id") + "</option>");

    });

    $(".code.header").on("click", function(event) {
        $("#editor").find("tbody").find("tr").remove();
        var codeName = $(this).text();
        $(".modal").attr("id", codeName);
        var codes = eventDecoLabels[codeName];
        codes.forEach(function(code) {
            addCodeRow(code);
        });

        $(".code").hover(
            function(event) {
                if ($(this).has(".disabled").length != 0) {
                    $(this).children().has(".edit").show();
                }
            }, function(event) {
                $(this).children().has(".edit").hide();
            });

        $(".shortcut").hover(
            function(event) {
                if ($(this).has(".disabled").length != 0) {
                    $(this).children().has(".edit").show();
                }
            }, function(event) {
                $(this).children().has(".edit").hide();
            });

/*
        $(".icon.button").has(".checkmark").on("click", function(event) {
            $(this).hide();
            $(this).siblings(".button").hide();
            $(this).siblings(".input").toggleClass("disabled");
            $(this).siblings(".input").toggleClass("focus");

            var newValue =  $(this).siblings(".input").find("input").val();
            $(this).siblings(".input").find("input").attr("value", newValue);

        });

        $(".icon.button").has(".remove").on("click", function(event) {
            $(this).hide();
            $(this).siblings(".button").hide();
            $(this).siblings(".input").toggleClass("disabled");
            $(this).siblings(".input").toggleClass("focus");

            var oldValue =  $(this).siblings(".input").find("input").attr("value");
            $(this).siblings(".input").find("input").val(oldValue);

        });

        $(".icon.button").has(".edit").on("click", function(event) {
            $(this).hide();
            $(this).siblings(".button").show();
            $(this).siblings(".input").toggleClass("disabled");
            $(this).siblings(".input").toggleClass("focus");

            var input = $(this).siblings(".input").find(".code-input");

             if (input.length == 0) {
                input = $(this).siblings(".input").find(".shortcut-input");
             }

            input[0].selectionStart = input[0].selectionEnd = input.val().length;

        });
*/
        $('.modal')
            .modal('show')
        ;

    });


});