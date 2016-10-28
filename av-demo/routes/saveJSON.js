/**
 * Created by fletna on 19/09/16.
 */
var express = require('express');
var router = express.Router();
var fs = require("fs");


router.post('/', function(req, res, next) {
    fs.writeFile( "filename.json", JSON.stringify( myJson ), "utf8", yourCallback );
})

module.exports = router;
