const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Document = require("../models/Document");
const { v4: uuidv4 } = require('uuid');

// 1. Get all documents
router.get("/", auth, async (req, res) => {
  try {
    // 🔍 FIX: Change 'collaborators' to 'collaborators.user'
    const docs = await Document.find({
      $or: [
        { owner: req.user.id }, 
        { 'collaborators.user': req.user.id } // <--- THIS IS THE KEY FIX
      ],
    }).sort({ updatedAt: -1 });
    
    res.json(docs);
  } catch (err) {
    console.error("❌ Error fetching docs:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. Create a new document
router.post("/", auth, async (req, res) => {
  try {
    const { title } = req.body;
    const newDoc = new Document({
      _id: uuidv4(), 
      title: title || "Untitled Document",
      owner: req.user.id,
      data: {}, 
      collaborators: [] // Start empty
    });

    const doc = await newDoc.save();
    res.json(doc);
  } catch (err) {
    console.error("❌ Error creating doc:", err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Delete a document
router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ msg: "Document not found" });

    if (doc.owner.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    await doc.deleteOne();
    res.json({ msg: "Document removed" });
  } catch (err) {
    console.error("Error deleting doc:", err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;