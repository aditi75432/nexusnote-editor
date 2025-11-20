// server/clean.js
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Deleting old documents...");
    // Delete documents that don't match the new schema (or all of them to be safe)
    await mongoose.connection.db.collection('documents').deleteMany({}); 
    console.log("Database wiped clean! ✨");
    process.exit(0);
  })
  .catch(err => console.log(err));