require('dotenv').config();
const app = require('./src/app');

const port = process.env.PORT || 3000;

// ✅ Define routes FIRST
app.get("/", (req, res) => {
  res.send("CodeGuard Backend is Running 🚀");
});

// ✅ Then start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});