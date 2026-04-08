const express = require('express');
const { analyze, submit, getSubmissions } = require('../controllers/analysisController');
const validate = require('../middleware/validation');

const router = express.Router();

router.post('/analyze', validate.analyze, analyze);
router.post('/submissions', validate.submit, submit);
router.get('/submissions', getSubmissions);

module.exports = router;