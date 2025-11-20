import React, { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import QuillCursors from "quill-cursors"; 
import { io } from "socket.io-client";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from 'react-hot-toast';

// Only register if it hasn't been registered yet
if (!Quill.imports['modules/cursors']) {
  Quill.register('modules/cursors', QuillCursors);
}

const SAVE_INTERVAL_MS = 2000;

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + "00000".substring(0, 6 - c.length) + c;
}

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();
  const [title, setTitle] = useState("Untitled Document");
  const [activeUsers, setActiveUsers] = useState([]); 
  const [currentUser, setCurrentUser] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [role, setRole] = useState("viewer"); 
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch User
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      try {
        const res = await axios.get('http://localhost:5000/api/auth/me', {
          headers: { 'x-auth-token': token }
        });
        setCurrentUser(res.data);
      } catch (err) { navigate('/login'); }
    };
    fetchUser();
  }, [navigate]);

  // 2. Connect Socket
  useEffect(() => {
    if (!currentUser) return;
    const s = io("http://localhost:5000");
    setSocket(s);
    return () => s.disconnect();
  }, [currentUser]);

  // 3. Setup Quill
  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    
    const q = new Quill(editor, { 
      theme: "snow", 
      modules: { 
        toolbar: TOOLBAR_OPTIONS, 
        cursors: { transformOnTextChange: true } 
      } 
    });
    
    q.disable(); 
    q.setText("Loading...");
    setQuill(q);
  }, []);

  // 4. Core Logic
  useEffect(() => {
    if (socket == null || quill == null || !currentUser) return;
    
    const cursorsModule = quill.getModule('cursors');

    const searchParams = new URLSearchParams(location.search);
    const inviteRole = searchParams.get('role'); 

    socket.emit("get-document", { 
      documentId, 
      user: { username: currentUser.username, userId: currentUser._id },
      inviteRole 
    });

    socket.once("load-document", (document) => {
      quill.setContents(document.data);
      setTitle(document.title);
      setRole(document.role);

      if (document.role === 'viewer') {
        quill.disable();
        toast('Read-Only Mode');
      } else {
        quill.enable();
      }
    });

    socket.on("update-users", (users) => setActiveUsers(users));
    socket.on("receive-title-change", (newTitle) => setTitle(newTitle));
    
    const changeHandler = (delta) => quill.updateContents(delta);
    socket.on("receive-changes", changeHandler);

    const cursorHandler = ({ range, user }) => {
      if (user.userId === currentUser._id) return;
      try {
        cursorsModule.createCursor(user.userId, user.username, stringToColor(user.username));
        cursorsModule.moveCursor(user.userId, range);
        cursorsModule.toggleFlag(user.userId, true);
      } catch (e) {}
    };
    socket.on("remote-cursor-move", cursorHandler);

    return () => {
      socket.off("receive-changes", changeHandler);
      socket.off("receive-title-change");
      socket.off("update-users");
      socket.off("remote-cursor-move", cursorHandler);
    };
  }, [socket, quill, documentId, currentUser, location.search]);

  // 5. Broadcast Changes
  useEffect(() => {
    if (socket == null || quill == null) return;

    const textHandler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };

    const selectionHandler = (range, oldRange, source) => {
      if (source !== "user" || !range) return;
      socket.emit("cursor-move", range);
    };

    quill.on("text-change", textHandler);
    quill.on("selection-change", selectionHandler);

    return () => {
      quill.off("text-change", textHandler);
      quill.off("selection-change", selectionHandler);
    };
  }, [socket, quill]);

  // 6. Auto-Save
  useEffect(() => {
    if (socket == null || quill == null || role === 'viewer') return;
    const interval = setInterval(() => {
      socket.emit("save-document", { data: quill.getContents(), title });
    }, SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [socket, quill, title, role]);

  // Handlers
  const handleTitleChange = (e) => {
    if (role === 'viewer') return;
    const newTitle = e.target.value;
    setTitle(newTitle);
    socket.emit("send-title-change", newTitle);
  };

  const copyShareLink = (shareRole) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const link = shareRole === 'viewer' ? `${baseUrl}?role=viewer` : baseUrl;
    navigator.clipboard.writeText(link);
    toast.success(`Copied ${shareRole === 'viewer' ? 'Read-Only' : 'Edit'} Link`);
  };

  const handleManualSave = () => {
    if (role === 'viewer') return;
    setIsSaving(true);
    socket.emit("save-document", { data: quill.getContents(), title });
    setTimeout(() => { setIsSaving(false); toast.success("Saved successfully"); }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    toast.success("Logged out");
  };

  const handleAI = async (type) => {
    if (!quill || role === 'viewer') return;
    
    const selection = quill.getSelection();
    const selectedText = selection && selection.length > 0 ? quill.getText(selection.index, selection.length) : "";
    const allText = quill.getText();
    
    if ((type === 'grammar' || type === 'enhance' || type === 'summarize') && !selectedText) {
      toast.error("Please highlight some text first");
      return;
    }

    const toastId = toast.loading("AI is thinking...");

    try {
      const context = type === 'complete' ? allText.slice(-100) : "";
      const textToSend = selectedText || allText;

      const res = await axios.post("http://localhost:5000/api/ai/generate", { 
        text: textToSend, 
        context, 
        type 
      });
      
      const aiOutput = res.data.result;
      setAiResult(aiOutput); 

      if (type === 'complete') {
         const cursorIndex = selection ? selection.index : quill.getLength() - 1;
         quill.insertText(cursorIndex, ` ${aiOutput}`, 'api');
      } 
      else if (type === 'grammar' || type === 'enhance') {
         const range = quill.getSelection();
         quill.insertText(range.index + range.length, `\n\n[AI Suggestion]:\n${aiOutput}\n`, 'bold', true);
      }
      
      toast.success("AI Task Completed", { id: toastId });
    } catch (err) {
      toast.error("AI Request Failed", { id: toastId });
    }
  };

  return (
    <div className="container" style={{flexDirection: 'column'}}>
      <div className="editor-header" style={{
          padding: '10px 20px', background: '#f8f9fa', borderBottom: '1px solid #ddd',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
        }}>
        
        <div style={{display: 'flex', alignItems: 'center', flex: 1}}>
          <span style={{
            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '10px', fontWeight: 'bold',
            background: role === 'owner' ? '#ffd700' : role === 'editor' ? '#e0e0e0' : '#b3e5fc', color: '#333'
          }}>{role.toUpperCase()}</span>
          <input value={title} onChange={handleTitleChange} disabled={role === 'viewer'}
            style={{fontSize: '18px', fontWeight: 'bold', border: 'none', background: 'transparent', width: '100%'}} 
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ display: 'flex', marginRight: '10px' }}>
            {activeUsers.map((u, i) => (
              <div key={i} title={u.username} style={{
                width: '32px', height: '32px', borderRadius: '50%', 
                background: stringToColor(u.username || "User"), color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'bold', fontSize: '14px', marginLeft: '-10px', border: '2px solid white'
              }}>{u.username ? u.username.charAt(0).toUpperCase() : "?"}</div>
            ))}
          </div>

          <button className="btn-ai" onClick={handleManualSave} disabled={role === 'viewer' || isSaving} style={{background: '#007bff', width: 'auto', margin: 0}}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <div style={{display:'flex', gap:'2px'}}>
             <button className="btn-ai" onClick={() => copyShareLink('editor')} style={{background: '#28a745', width: 'auto', margin: 0, marginRight:0, borderRadius: '4px 0 0 4px'}}>Share Edit</button>
             <button className="btn-ai" onClick={() => copyShareLink('viewer')} style={{background: '#218838', width: 'auto', margin: 0, marginLeft:0, borderRadius: '0 4px 4px 0'}}>View</button>
          </div>

          <button className="btn-ai" onClick={() => navigate('/dashboard')} style={{background: '#6c757d', width: 'auto', margin: 0}}>Home</button>
          <button className="btn-ai" onClick={handleLogout} style={{background: '#dc3545', width: 'auto', margin: 0}}>Logout</button>
        </div>
      </div>

      <div style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
        <div className="editor-container">
          <div id="container" ref={wrapperRef}></div>
        </div>
        <div className="sidebar">
           <h3>AI Assistant</h3>
           <p style={{fontSize:'12px', color: '#888', marginBottom: '15px'}}>
             Access Level: <span style={{fontWeight:'bold'}}>{role.toUpperCase()}</span>
           </p>

           {/* 🚀 UPDATED: HORIZONTAL LAYOUT */}
           <div style={{marginBottom: '15px'}}>
             <h5 style={{margin: '5px 0 8px 0', color: '#555'}}>Refine Selection</h5>
             <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
               <button className="btn-ai" onClick={() => handleAI('grammar')} disabled={role === 'viewer'} style={{flex: 1, margin: 0}}>
                 Grammar
               </button>
               <button className="btn-ai" onClick={() => handleAI('enhance')} disabled={role === 'viewer'} style={{background: '#6f42c1', flex: 1, margin: 0}}>
                 Enhance
               </button>
               <button className="btn-ai" onClick={() => handleAI('summarize')} disabled={role === 'viewer'} style={{background: '#17a2b8', flex: 1, margin: 0}}>
                 Summarize
               </button>
             </div>
           </div>

           <div style={{marginBottom: '15px'}}>
             <h5 style={{margin: '5px 0 8px 0', color: '#555'}}>Create & Insight</h5>
             <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
               <button className="btn-ai" onClick={() => handleAI('complete')} disabled={role === 'viewer'} style={{background: '#28a745', flex: 1, margin: 0}}>
                 Complete
               </button>
               <button className="btn-ai" onClick={() => handleAI('suggestions')} disabled={role === 'viewer'} style={{background: '#fd7e14', flex: 1, margin: 0}}>
                 Ideas
               </button>
               <button className="btn-ai" onClick={() => handleAI('tone')} disabled={role === 'viewer'} style={{background: '#20c997', flex: 1, margin: 0}}>
                 Tone
               </button>
             </div>
           </div>

           <hr />
           
           <h4>AI Insights:</h4>
           <div style={{ 
             background: 'white', 
             padding: '12px', 
             borderRadius: '8px', 
             fontSize: '13px', 
             lineHeight: '1.5',
             border: '1px solid #ddd',
             minHeight: '150px',
             maxHeight: '300px',
             overflowY: 'auto',
             whiteSpace: 'pre-wrap'
           }}>
             {aiResult || "Select text or type, then click a button to see AI output here."}
           </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}