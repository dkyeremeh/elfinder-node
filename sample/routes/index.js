var express = require('express'),
    elfinder = require('../controllers/elfinder.js')
;
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var path = require('path'); 

  elfinder.readdir(path.resolve('./media/public/') + '\\').then(function(result){
    res.json(result);
  });
  
});

module.exports = router;
