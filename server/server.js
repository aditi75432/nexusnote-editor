require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

// Import Models
const Document = require("./models/Document");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

// Security Configuration
// Disable crossOriginResourcePolicy to allow frontend communication
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Rate Limiting (DDoS Protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/documents", require("./routes/documents"));

// AI Route
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.post("/api/ai/generate", async (req, res) => {
  try {
    const { text, type, context } = req.body;
    let prompt = "";

    switch (type) {
      case "grammar":
        prompt = `Correct the grammar and spelling of the following text. Do not change the meaning, just fix errors:\n\n"${text}"`;
        break;
      
      case "enhance":
        prompt = `Rewrite the following text to improve clarity, tone, and readability. Make it sound more professional:\n\n"${text}"`;
        break;
      
      case "summarize":
        prompt = `Summarize the following text in a concise bulleted list:\n\n"${text}"`;
        break;
      
      case "tone":
        prompt = `Analyze the tone and sentiment of this text. Is it positive, negative, or neutral? What emotions are present? Provide a short analysis:\n\n"${text}"`;
        break;
      
      case "complete":
        prompt = `Complete the following sentence naturally and creatively. Keep it to 1-2 sentences:\n\n"${context || text}"`;
        break;
        
      case "suggestions":
        prompt = `Read this text and provide 3 creative ideas or writing suggestions on what to add next to expand the content:\n\n"${text}"`;
        break;

      default:
        prompt = `Improve this text: ${text}`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ result: response.text() });
  } catch (e) {
    console.error("AI Error:", e);
    res.status(500).json({ error: "AI Request Failed" });
  }
});

// Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
});

const socketUserMap = new Map();

io.on("connection", (socket) => {
  
  // Handle user joining a document
  socket.on("get-document", async ({ documentId, user, inviteRole }) => {
    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);

    let role = "viewer"; // Default role

    if (user && user.userId) {
      // Check ownership
      if (document.owner && document.owner.toString() === user.userId) {
        role = "owner";
      } else {
        // Check existing collaboration status
        const existingCollab = document.collaborators.find(c => c.user.toString() === user.userId);
        if (existingCollab) {
          role = existingCollab.role;
        } else {
          // New user: Use invite role or default to editor
          role = inviteRole === 'viewer' ? 'viewer' : 'editor';
          
          await Document.findByIdAndUpdate(documentId, {
            $addToSet: { collaborators: { user: user.userId, role: role } }
          });
        }
      }
      // Map socket to user and role
      socketUserMap.set(socket.id, { ...user, documentId, role });
    }

    // Send initial data and role
    socket.emit("load-document", {
      data: document.data,
      title: document.title,
      role: role 
    });

    // Broadcast active users
    const usersInRoom = Array.from(socketUserMap.values())
      .filter(u => u.documentId === documentId);
    io.to(documentId).emit("update-users", usersInRoom);

    // Handle text changes
    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    // Handle title changes (restricted)
    socket.on("send-title-change", (title) => {
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo?.role === 'viewer') return; 
      
      socket.broadcast.to(documentId).emit("receive-title-change", title);
      Document.findByIdAndUpdate(documentId, { title });
    });

    // Handle document save (restricted)
    socket.on("save-document", async ({ data, title }) => {
      const userInfo = socketUserMap.get(socket.id);
      if (userInfo && (userInfo.role === "owner" || userInfo.role === "editor")) {
        await Document.findByIdAndUpdate(documentId, { data, title });
      }
    });
    
    // Handle cursor movements
    socket.on("cursor-move", (range) => {
      const userInfo = socketUserMap.get(socket.id);
      socket.broadcast.to(documentId).emit("remote-cursor-move", {
        range,
        user: userInfo
      });
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const userInfo = socketUserMap.get(socket.id);
    if (userInfo) {
      const { documentId } = userInfo;
      socketUserMap.delete(socket.id);
      const usersInRoom = Array.from(socketUserMap.values())
        .filter(u => u.documentId === documentId);
      io.to(documentId).emit("update-users", usersInRoom);
    }
  });
});

async function findOrCreateDocument(id) {
  if (id == null) return;
  const document = await Document.findById(id);
  if (document) return document;
  
  return await Document.create({ 
    _id: id, 
    data: {}, 
    title: "Untitled Document",
    collaborators: [] 
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});