const Joi = require('joi');

const analyzeSchema = Joi.object({
  code1: Joi.string().required(),
  code2: Joi.string().required(),
  language: Joi.string().required()
});

const submitSchema = analyzeSchema;

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    next();
  };
};

module.exports = {
  analyze: validate(analyzeSchema),
  submit: validate(submitSchema)
};