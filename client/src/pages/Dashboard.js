import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import toast from 'react-hot-toast';

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const navigate = useNavigate();

  // Fetch documents on load
  useEffect(() => {
    const fetchDocs = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        const res = await axios.get('https://nexusnote-backend.onrender.com/api/documents', {
          headers: { 'x-auth-token': token }
        });
        setDocs(res.data);
      } catch (err) {
        toast.error('Failed to fetch documents');
      }
    };
    fetchDocs();
  }, [navigate]);

  // Create New Doc
  const createDoc = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('https://nexusnote-backend.onrender.com/api/documents', 
        { title: 'Untitled Document' },
        { headers: { 'x-auth-token': token } }
      );
      navigate(`/documents/${res.data._id}`);
    } catch (err) {
      toast.error('Error creating document');
    }
  };

  // Delete Doc
  const deleteDoc = async (id, e) => {
    e.stopPropagation(); // Prevent clicking the card
    if(!window.confirm("Are you sure?")) return;
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`https://nexusnote-backend.onrender.com/api/documents/${id}`, {
        headers: { 'x-auth-token': token }
      });
      setDocs(docs.filter(d => d._id !== id));
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Error deleting document');
    }
  };

  return (
    <div className="container" style={{display: 'block', padding: '40px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>📄 My Documents</h1>
        <button onClick={createDoc} className="btn-ai" style={{fontSize: '16px'}}>+ New Document</button>
      </div>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '30px'}}>
        {docs.map(doc => (
          <div key={doc._id} 
               onClick={() => navigate(`/documents/${doc._id}`)}
               style={{padding: '20px', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: 'white', position: 'relative'}}>
            <h3 style={{marginTop: 0}}>{doc.title || "Untitled"}</h3>
            <p style={{color: '#666', fontSize: '12px'}}>Last modified: {new Date(doc.updatedAt).toLocaleDateString()}</p>
            <button 
              onClick={(e) => deleteDoc(doc._id, e)}
              style={{position: 'absolute', top: '10px', right: '10px', background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer'}}>
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}