const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  code1: { type: String, required: true },
  code2: { type: String, required: true },
  similarity: { type: Number, required: true },
  astScore: { type: Number, required: true },
  fingerprintScore: { type: Number, required: true },
  stylometryScore: { type: Number, required: true },
  language: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Indexes
submissionSchema.index({ createdAt: -1 });
submissionSchema.index({ similarity: -1 });

module.exports = mongoose.model('Submission', submissionSchema);