const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const analysisRoutes = require('./routes/analysisRoutes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const connectDB = require('./config/database');

const app = express();
app.get("/", (req, res) => {
  res.send("CodeGuard Backend is Running 🚀");
});

// Connect to DB
connectDB();



// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Prevent large payload abuse
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', analysisRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;