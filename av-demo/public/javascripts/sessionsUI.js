/**
 * Created by fletna on 16/09/16.
 */
var dataset = {eventDeco: {}};
var eventDecoOrder = [];
var eventDecoLabels = {}

d3.json("../models/sessions.json", function(data) {

    var headerLabels = ["session_id"];
    data[Object.keys(data)[0]]["events"].forEach(function(event, i) {
        if (i<2) {
            headerLabels.push(event["name"] + ":timestamp");
            headerLabels.push(event["name"] + ":data");
            Object.keys(event["decorations"]).forEach(function(decoKey) {
                headerLabels.push(event["name"] + ":" + decoKey);
                if (eventDecoOrder.indexOf(decoKey) === -1) eventDecoOrder.push(decoKey);
                if (!eventDecoLabels.hasOwnProperty(decoKey)) eventDecoLabels[decoKey] = [];
            });
        }

    });

    Object.keys(data).forEach(function(key) { extractLabels(data[key]);});

    var flattenSession = function(session) {
        var flat = [];
        session["events"].forEach(function(event,i) {
            if (i<2) {
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

    var table = d3.select("#table-container").append("table")
        .attr("class", "ui selectable celled table")
        .append("thead").append("tr");

    var header = table.selectAll("th").data(headerLabels).enter()
        .append("th")
        .text(function (d) {return d});

    var body = d3.select("table").append("tbody")
        .selectAll("tr").data(Object.keys(data).map(sessionId => [sessionId, data[sessionId]])).enter()
        .append("tr")
        .attr("session-id", function(sessionData) {return sessionData[0];})
        .selectAll("td").data(function (sessionData) {
            var flatSession = [sessionData[0]].concat(flattenSession(sessionData[1]));
            flatSession = flatSession.map(function(el) { return {"session": sessionData[1], "sessionId" : sessionData[0], "cell": el};});
            if (flatSession.length < headerLabels.length) {
                var difference = headerLabels.length-flatSession.length;
                for (var i = 0; i < difference; i++) {
                    var placeholder = {"session": sessionData[1], "sessionId" : sessionData[0], "cell": ""}
                    flatSession.push(placeholder);
                }
            } return flatSession;

        }).enter()
        .append("td")
        .attr("id", function(d,i) {return d["sessionId"] + "-" + headerLabels[i];})
        .each(function (cellValue, i) {
            Object.keys(eventDecoLabels).forEach(function(decoration) {
                    if (!headerLabels[i].endsWith(":" + decoration)) {
                        d3.select("td[id='" + cellValue["sessionId"] + "-" + headerLabels[i] +"'").text(cellValue["cell"]);
                    } else {
                        if (cellValue["cell"] != "") {
                            d3.select("td[id='" + cellValue["sessionId"] + "-" + headerLabels[i] + "'").append("select")
                                .attr("class", "ui search dropdown")
                                .selectAll("option").data(eventDecoLabels[decoration]).enter()
                                .append("option")
                                .attr("value", function (d) {
                                    return d;
                                })
                                .text(function (d) {
                                    return d;
                                });
                            console.log(cellValue["cell"]);
                            $("td[id='" + cellValue["sessionId"] + "-" + headerLabels[i] + "']").children("select").dropdown("set selected", cellValue["cell"]);
                        }
                    }
            });
        });
});