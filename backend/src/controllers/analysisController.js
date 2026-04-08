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

module.exports = { analyze, submit, getSubmissions };