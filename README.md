# NexusNote - Collaborative Text Editor with AI Assistant

## Project Overview
NexusNote is a production-ready real-time collaborative text editor designed to replicate the core functionality of Google Docs. It allows multiple users to edit documents simultaneously with sub-200ms latency, manage document permissions via Role-Based Access Control (RBAC), and utilize an integrated AI writing assistant powered by Google Gemini.

The application is built using the MERN stack (MongoDB, Express, React, Node.js) and is containerized using Docker for scalable deployment.

<br> 
Deployment Link - https://nexusnote-frontend.onrender.com

<br>
Demo- 

https://github.com/user-attachments/assets/b0b045c5-0631-40d9-9dc4-edc808960d7d



## Features

### Core Functionality
* **Real-time Collaboration:** Users can edit documents simultaneously. Changes are synchronized instantly using Socket.io and Quill Deltas to prevent overwriting conflicts.
* **Live Presence:** Active users are displayed in the header. User cursors and text selections are visible in real-time with unique color coding for identification.
* **Document Management:** Users can create, list, and delete documents via a persistent dashboard.
* **Authentication:** Secure user registration and login using JWT (JSON Web Tokens) and bcrypt password hashing.

### Access Control (RBAC)
* **Owner:** Full control over the document, including deletion.
* **Editor:** Can edit content, change titles, and save changes.
* **Viewer:** Read-only access. The editor and AI tools are disabled to prevent unauthorized modifications.
* **Sharing:** Unique link generation for both Editor and Viewer access levels.

### AI Assistant (Google Gemini Integration)
* **Grammar Correction:** Fixes grammar and punctuation errors in selected text.
* **Text Enhancement:** Rewrites text to improve professional tone and clarity.
* **Summarization:** Generates bullet-point summaries of content.
* **Auto-Completion:** Context-aware sentence completion based on preceding text.
* **Tone Analysis:** Analyzes the sentiment and emotional tone of the document.
* **Writing Suggestions:** Provides creative ideas for continuing the text.

### Security Features
* **Rate Limiting:** API requests are limited to prevent DDoS attacks (100 requests per 15 minutes per IP).
* **Secure Headers:** Helmet.js implementation to secure HTTP headers.
* **CORS Configuration:** Strict origin policies to allow only authorized client connections.
* **Input Sanitization:** Managed via Mongoose schemas and Quill content handling.

## Technical Architecture

### Frontend
* **Framework:** React.js
* **Rich Text Editor:** Quill.js (v2)
* **Cursor Module:** Quill-Cursors (Custom CSS implementation)
* **State Management:** React Hooks (useState, useEffect, useCallback)
* **Routing:** React Router DOM
* **Notifications:** React Hot Toast

### Backend
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB (Mongoose ODM)
* **WebSockets:** Socket.io (with room-based isolation)
* **AI Provider:** Google Generative AI SDK (Model: gemini-2.5-flash)

### DevOps
* **Containerization:** Docker and Docker Compose
* **Deployment:** AWS EC2 (Ubuntu 24.04 LTS) / Render

## Setup and Installation

### Prerequisites
* Node.js (v18 or higher)
* MongoDB (Local service or Atlas connection string)
* Google Gemini API Key

### 1. Clone the Repository
```bash
git clone <repository-url>
cd nexusnote-editor
````

### 2\. Backend Configuration

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

Create a file named .env in the server directory with the following content:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/nexusnote_v2
JWT_SECRET=your_secure_secret_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
CLIENT_URL=http://localhost:3000
```

### 3\. Frontend Configuration

Navigate to the client directory and install dependencies:

```bash
cd ../client
npm install --legacy-peer-deps
```

### 4\. Running Locally

You will need two terminal windows.

**Terminal 1 (Server):**

```bash
cd server
npm run dev
```

**Terminal 2 (Client):**

```bash
cd client
npm start
```

The application will launch at http://localhost:3000.

## Deployment

The application includes a multi-stage Dockerfile for production deployment.

### Docker Deployment

To run the entire stack with a single command:

```bash
docker-compose up -d --build
```

The application will be available on port 80 (mapped to container port 5000).

### Environment Variables for Production

Ensure the following variables are set in your production environment (AWS/Render):

  * PORT: 5000
  * MONGO\_URI: Your MongoDB Atlas Connection String
  * JWT\_SECRET: A strong, random string
  * GEMINI\_API\_KEY: Your Google AI API Key
  * CLIENT\_URL: The public URL of your deployed frontend

## Performance and Quality Standards

This project adheres to the following performance metrics required for the SDE Intern position:

  * **Concurrency:** Supports 10+ concurrent users per document without sync loss.
  * **Latency:** Real-time synchronization latency is maintained below 200ms via optimized Socket.io event handling.
  * **AI Response:** Optimized using the gemini-1.5-flash-latest model to ensure response times under 5 seconds.
  * **Startup Time:** Application initializes in under 15 seconds.
  * **Data Integrity:** Minimal data loss during collaborative editing due to the use of Operational Transformation (Quill Deltas).
  * **Code Quality:** The codebase follows a modular architecture with clean separation of concerns, comprehensive error handling, and meaningful commit messages.

## Intern Learning Documentation

### Learning Log

During this assignment, I gained practical knowledge in:

1.  **WebSocket Architecture:** Understanding the difference between HTTP request/response and bidirectional socket communication for real-time state synchronization.
2.  **Operational Transformation:** Learned how Quill Deltas handle text changes mathematically to prevent overwriting conflicts during simultaneous edits.
3.  **JWT Security:** Implemented secure session management and middleware protection for API routes.
4.  **Docker Containerization:** Learned to create multi-stage Docker builds to serve a React frontend through a Node.js backend for production.

### Challenges Faced and Solutions

**1. Infinite Loop in Text Synchronization**

  * **Challenge:** When User A typed, the change was sent to User B. User B's editor applied the change, which triggered a local text-change event, sending it back to User A, creating an infinite loop.
  * **Solution:** Implemented a source check in the frontend. Changes are only broadcast to the socket if the source of the edit is "user". API or socket-driven changes are ignored by the emitter.

**2. Schema Data Type Mismatch (500 Errors)**

  * **Challenge:** Initially, document content was stored as a String. Moving to a more complex Object structure for Quill Deltas caused the database to crash when reading old documents that did not match the new schema.
  * **Solution:** Refactored the Mongoose Schema to enforce strict typing (data: Object) and performed a database migration to remove incompatible legacy data.

**3. Collaborative Cursor Visibility**

  * **Challenge:** The quill-cursors library had version conflicts with React 18, preventing the default CSS from loading, making cursors invisible.
  * **Solution:** Manually implemented the CSS for cursor flags and carets in the application stylesheet to force visibility and ensure consistent color coding derived from user hashes.

**4. AI Model Versioning**

  * **Challenge:** The standard gemini-pro model returned 404 errors due to API deprecation and regional availability changes during development.
  * **Solution:** Updated the backend service to use the stable gemini-1.5-flash-latest model, which improved response times and resolved the API connection errors.

### Technical Decisions

  * **Socket.io over WebRTC:** Socket.io was chosen for its reliability in text-based data sync and built-in room management, which simplified the document isolation logic compared to peer-to-peer WebRTC.
  * **Quill.js:** Selected for its Delta format, which is essential for conflict-free collaborative editing.
  * **MongoDB:** Chosen for its flexibility in storing unstructured JSON data (Deltas) associated with documents.

### Future Improvements

1.  **Version History:** Implement a rollback feature to view and restore previous versions of the document.
2.  **Redis Caching:** Integrate Redis to cache document states for faster load times and reduced database writes during high traffic.
3.  **Email Invites:** Replace the link-sharing mechanism with a secure email invitation system using NodeMailer.



```
```
