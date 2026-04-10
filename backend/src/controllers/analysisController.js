const plagiarismService = require('../services/plagiarismService');
const Submission = require('../models/Submission');

const analyze = async (req, res, next) => {
  try {
    const { code1, code2, language } = req.body;
    const result = await plagiarismService.analyzePlagiarism(code1, code2, language);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const analyzeDocument = async (req, res, next) => {
  try {
    const { text, filename } = req.body;
    const result = await plagiarismService.analyzeDocument(text, filename);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const scan = async (req, res, next) => {
  try {
    let fileContent, filename;
    if (req.file) {
      fileContent = req.file.buffer.toString('utf-8');
      filename = req.file.originalname;
    } else if (req.body.text) {
      fileContent = req.body.text;
      filename = req.body.filename || 'uploaded.txt';
    } else {
      return res.status(400).json({ error: 'No file or text provided' });
    }
    console.log('File content received:', fileContent.substring(0, 200) + '...');
    const result = await plagiarismService.scanFile(fileContent, filename);
    console.log('Analysis results:', result);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const submit = async (req, res, next) => {
  try {
    const { code1, code2, language } = req.body;
    const result = await plagiarismService.analyzePlagiarism(code1, code2, language);
    const submission = new Submission({
      code1,
      code2,
      ...result,
      language
    });
    await submission.save();
    res.status(201).json({ message: 'Submission saved', id: submission._id });
  } catch (error) {
    next(error);
  }
};

const getSubmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const submissions = await Submission.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Submission.countDocuments();
    res.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { analyze, analyzeDocument, scan, submit, getSubmissions };