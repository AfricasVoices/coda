var express = require('express');
var router = express.Router();
var fs = require("fs");


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('sessions', { title: 'Express' });
});

router.post('/save', function(req, res, next) {
    fs.writeFile("../models/saved.json", JSON.stringify(req.body), "utf8", function(a,b) {
        res.send({message:"Success!"});
    });
});


module.exports = router;
