import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Register() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('https://nexusnote-backend.onrender.com/api/auth/register', formData);
      localStorage.setItem('token', res.data.token);
      toast.success('Registered successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Registration failed');
    }
  };

  return (
    <div className="auth-box">
      <h2>Create Account</h2>
      <form onSubmit={onSubmit}>
        <input type="text" placeholder="Username" onChange={e => setFormData({...formData, username: e.target.value})} required />
        <input type="email" placeholder="Email" onChange={e => setFormData({...formData, email: e.target.value})} required />
        <input type="password" placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} required />
        <button type="submit" className="btn-ai" style={{width: '100%'}}>Sign Up</button>
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}