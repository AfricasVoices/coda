/**
 * Created by fletna on 16/09/16.
 */
var eventDecoOrder = [];
var eventDecoLabels = {};
var dataset;

d3.json("../models/sessions.json", function(data) {

    dataset = data;

    var headerLabels = ["session_id", "timestamp", "data"];
    var event = data[Object.keys(data)[0]]["events"][0];

    Object.keys(event["decorations"]).forEach(function(decoKey) {
        headerLabels.push(decoKey);
        eventDecoOrder.push(decoKey);//if (eventDecoOrder.indexOf(decoKey) === -1) eventDecoOrder.push(decoKey);
        eventDecoLabels[decoKey] = [];//if (!eventDecoLabels.hasOwnProperty(decoKey)) eventDecoLabels[decoKey] = [];
    });


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
                    rows.push(eventObj);
                }
            });

        });

        return rows;
    }

    var table = d3.select("#table-container").append("table")
        .attr("class", "ui selectable celled table")
        .append("thead").append("tr");

    var header = table.selectAll("th").data(headerLabels).enter()
        .append("th")
        .text(function (d) {return d});

    var body = d3.select("table").append("tbody")
        .selectAll("tr").data(createEventRows(Object.keys(data))).enter()
        .append("tr")
        .attr("session-id", function(row) {return row.__sessionID__;})
        .attr("row", function(row,i) {return i;})
        .selectAll("td").data(function (sessionData) {
            var trueKeys = Object.keys(sessionData).filter(key => !key.endsWith("_"));
            return trueKeys.map(key => [sessionData[key], sessionData.__sessionID__]);
        }).enter()
        .append("td")
        .attr("id", function(cell,i) {return cell[1] + "-" + headerLabels[i] + "-" + i;})
        .each(function (cell, i) {
            if (eventDecoOrder.indexOf(headerLabels[i]) ===-1) {
                d3.select(this).text(cell[0])
                    .attr("empty", cell[0] === "" ? "" : null)
                    .attr("full", cell[0] !== "" ? "" : null);
            } else {
                d3.select(this).append("select")
                    .attr("class", "ui search dropdown")
                    .selectAll("option").data(eventDecoLabels[headerLabels[i]]).enter()
                    .append("option")
                    .attr("value", function (d) { return d; })
                    .text(function (d) { return d; })
                    .attr("picked", function(d) {
                        return cell[0] === d ? "" : null;});
            }
        });

    d3.selectAll("option[picked]").each(function() {
        var currentPicked = this;
        $(this).parents("select").dropdown("set selected", $(this).attr("value"));
    });
    //d3.selectAll("td[empty]").each(function() {d3.select(this).attr("class","warning");})
    d3.selectAll("td[full]").each(function(empty,i) {
        (+$(this).parents("tr").attr("session-id") % 2) == 0 ? d3.select(this).attr("class","negative") : d3.select(this).attr("class","positive");
    });


});