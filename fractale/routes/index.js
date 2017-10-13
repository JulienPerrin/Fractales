var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});

router.get('/mandelbrot', function(req, res, next) {
  res.render('mandelbrot');
});

router.get('/sierpinski', function(req, res, next) {
  res.render('sierpinski');
});

module.exports = router;
