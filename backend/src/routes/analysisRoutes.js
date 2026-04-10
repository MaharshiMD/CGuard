const express = require('express');
const { analyze, analyzeDocument, submit, getSubmissions, scan } = require('../controllers/analysisController');
const validate = require('../middleware/validation');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const router = express.Router();

router.post('/analyze', validate.analyze, analyze);
router.post('/analyze-document', validate.analyzeDocument, analyzeDocument);
router.post('/submissions', validate.submit, submit);
router.get('/submissions', getSubmissions);
router.post('/scan', upload.single('file'), scan);

module.exports = router;