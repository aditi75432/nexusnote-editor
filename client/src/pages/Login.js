import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('https://nexusnote-backend.onrender.com/api/auth/login', formData);
      localStorage.setItem('token', res.data.token); // Save token
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    }
  };

  return (
    <div className="auth-box">
      <h2>Login to NexusNote</h2>
      <form onSubmit={onSubmit}>
        <input 
          type="email" 
          placeholder="Email" 
          onChange={e => setFormData({...formData, email: e.target.value})} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          onChange={e => setFormData({...formData, password: e.target.value})} 
          required 
        />
        <button type="submit" className="btn-ai" style={{width: '100%'}}>Login</button>
      </form>
      <p style={{marginTop: '10px'}}>
        New here? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}