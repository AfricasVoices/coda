/**
 * Created by fletna on 16/09/16.
 */
var express = require('express');
var router = express.Router();


router.get("/", function(req,res) {
    var Converter = require("csvtojson").Converter;
    var csvConverter = new Converter({
        delimiter : ";"
    });

    res.send()

    /*
    csvConverter.on("end_parsed", function(json){
        res.send(json);
    });
    */

    require("fs").createReadStream("../models/data.csv").pipe(csvConverter);

});

module.exports = router;



