const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  _id: String, // UUID
  title: { type: String, default: "Untitled Document" },
  data: { type: Object, default: {} },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // 🚀 UPDATED: Store Role with the User ID
  collaborators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, default: 'editor' } // 'editor' or 'viewer'
  }],
  
  lastModified: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Document", DocumentSchema);