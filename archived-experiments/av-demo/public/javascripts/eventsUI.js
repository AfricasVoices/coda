/**
 * Created by fletna on 16/09/16.
 */
var dataset = {eventDeco: {}};

d3.json("../models/sms.json", function(data) {

    Object.keys(data[0]).map(function (key, i) {
        if (!key.endsWith("_")) dataset["eventDeco"][key] = {"index": i, "labels": {}};
    });

    var table = d3.select("#table-container").append("table")
        .attr("class", "ui selectable celled table")
        .append("thead").append("tr");

    var header = table.selectAll("th").data(Object.keys(data[0])).enter()
        .append("th")
        .text(function (d) {
            return d
        });

    var body = d3.select("table").append("tbody")
        .selectAll("tr").data(data).enter()
        .append("tr")
        .selectAll("td").data(function (d) {
            return Object.keys(d).map(key=>[key, d[key]]);
        }).enter()
        .append("td")
        .each(function (KV, i) {
            if (KV[0].endsWith("_")) {
                d3.select(this).text(KV[1]);
            } else {
                dataset["eventDeco"][KV[0]]["labels"][KV[1]] = {"index": i};
            }
        });
/*
    d3.select("tbody").selectAll("tr").selectAll("td").each(function (tr, i) {//.selectAll("td")[0][header.size()-1]
        if (!tr[0].endsWith("_")) Object.keys(dataset["eventDeco"][tr[0]]["labels"][i] = tr[0]);
    });
*/

    d3.select("tbody").selectAll("tr").selectAll("td").each(function(td, i) {
        if (!td[0].endsWith("_")) {
            d3.select(this)
            .append("select").attr("class", function (d) {
                    return "ui search dropdown";})
                .selectAll("option").data(function(d) {
                    return Object.keys(dataset["eventDeco"][d[0]]["labels"]).map(label=>[label, d[1]]);})
                .enter()
                .append("option").attr("value", function(d) {
                    return d[0];
                 }).text(function(d) {
                     return d[0];
            });
            }
        });

    d3.selectAll("select").selectAll("option").each(function(d) {
        if (d[0] === d[1]) $(this).parent().dropdown('set selected', d[0]);
    })


            //return KV[1];})
        //.text(KV[1]);
           //.text(function (KV) { return KV[0].endsWith("_") ? KV[1] : null; });





$("table").stickyTableHeaders();
});
