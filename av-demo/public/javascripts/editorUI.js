$(".positive.icon.button").hide();
$(".negative.icon.button").hide();
$("#save").show();
$(".icon.button").has(".edit").hide();


function addCode(inputField) {
    if (event.keyCode == 13) {
        $(inputField).hide();

    }
}

function addCodeRow(codeName) {
    if (codeName === undefined) return;

    var row = d3.select("#editor").select("tbody").append("tr");
    var code = row.append("td").attr("class", "code");
    var shortcut = row.append("td").attr("class", "shortcut");

    code.append("div")
        .attr("class", codeName.length == 0 ? "ui input focus" : "ui disabled input")
        .append("input")
            .attr("class", "code-input")
            .attr("type", "text")
            .attr("name", "code")
            .attr("placeholder", "enter code name...")
            .attr("onkeydown", "addCode(this)")
            .attr("value", codeName.length >0 ? codeName : "");

    var editButtonCode = code.append("div")
        .attr("class", "ui mini icon button");
        editButtonCode.append("i")
        .attr("class", "edit icon");

    var checkmarkButtonCode = code.append("div")
        .attr("class", "ui mini positive icon button");
        checkmarkButtonCode.append("i")
        .attr("class", "checkmark icon");

    var removeButtonCode = code.append("div")
        .attr("class", "ui mini negative icon button");
        removeButtonCode.append("i")
        .attr("class", "remove icon");

    shortcut.append("div")
        .attr("class", codeName.length == 0 ? "ui input" : "ui disabled input")
        .append("input")
        .attr("class", "shortcut-input")
        .attr("type", "text")
        .attr("name", "shortcut")
        .attr("placeholder", "press key...")
        .attr("onkeydown", "addCode(this)");

    var editButtonShortcut = shortcut.append("div")
        .attr("class", "ui mini icon button");
        editButtonShortcut.append("i")
        .attr("class", "edit icon");

    var checkmarkButtonShortcut = shortcut.append("div")
        .attr("class", "ui mini positive icon button");
        checkmarkButtonShortcut.append("i")
        .attr("class", "checkmark icon");

    var removeButtonShortcut = shortcut.append("div")
        .attr("class", "ui mini negative icon button");
        removeButtonShortcut.append("i")
        .attr("class", "remove icon");

    if (codeName.length > 0) {
        $(checkmarkButtonCode[0]).hide();
        $(checkmarkButtonShortcut[0]).hide();
        $(removeButtonCode[0]).hide();
        $(removeButtonShortcut[0]).hide();
        $(editButtonCode[0]).hide();
        $(editButtonShortcut[0]).hide();
    } else {
        $(editButtonCode[0]).hide();
        $(editButtonShortcut[0]).hide();
    }


    $(checkmarkButtonCode[0]).on("click", confirm);
    $(removeButtonCode[0]).on("click", cancel);
    $(editButtonCode[0]).on("click", edit);
    $(code[0]).hover(
        function(event) {
            if ($(this).has(".disabled").length != 0) {
                $(this).children().has(".edit").show();
            }
        }, function(event) {
            $(this).children().has(".edit").hide();
        });
    $(checkmarkButtonShortcut[0]).on("click", confirm);
    $(removeButtonShortcut[0]).on("click", cancel);
    $(editButtonShortcut[0]).on("click", edit);
    $(shortcut[0]).hover(
        function(event) {
            if ($(this).has(".disabled").length != 0) {
                $(this).children().has(".edit").show();
            }
        }, function(event) {
            $(this).children().has(".edit").hide();
        });


};

var edit = function() {
    $(this).hide();
    $(this).siblings(".button").show();
    $(this).siblings(".input").toggleClass("disabled");
    $(this).siblings(".input").toggleClass("focus");

    var input = $(this).siblings(".input").find(".code-input");

    if (input.length == 0) {
        input = $(this).siblings(".input").find(".shortcut-input");
    }

    input[0].selectionStart = input[0].selectionEnd = input.val().length;
}

var confirm = function() {
    $(this).hide();
    $(this).siblings(".button").hide();
    $(this).siblings(".input").toggleClass("disabled");
    $(this).siblings(".input").toggleClass("focus");

    var newValue =  $(this).siblings(".input").find("input").val();
    $(this).siblings(".input").find("input").attr("value", newValue);
}

var cancel = function() {
    $(this).hide();
    $(this).siblings(".button").hide();
    $(this).siblings(".input").toggleClass("disabled");
    $(this).siblings(".input").toggleClass("focus");

    var oldValue =  $(this).siblings(".input").find("input").attr("value");
    $(this).siblings(".input").find("input").val(oldValue);
}




/*
 Label editor

d3.select("td[id='type-labels']").selectAll("a").data(eventDecoLabels["type"]).enter()
    .append("a")
    .attr("class", "ui orange circular label")
    .text(function(d) {return d;});

$(".button").on("click", (function(event) {
    eventDecoLabels["type"].push($("#type-label-input").val());
    d3.select("td[id='type-labels']").selectAll("a").data(eventDecoLabels["type"]).enter()
        .append("a")
        .attr("class", "ui orange circular label")
        .text(function(d) {return d;})
        .each(function(a) {
            $(".selection").children("select").append("<option>" + a +"</option>");
        });
}));
    */