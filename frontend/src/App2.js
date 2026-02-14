import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App2() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [imageDetails, setImageDetails] = useState({});
  const [apiUrl] = useState('/api'); // Use nginx proxy instead of direct backend
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('username'));
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [showLogin, setShowLogin] = useState(!localStorage.getItem('authToken'));

  useEffect(() => {
    // Check if token exists in localStorage
    const savedToken = localStorage.getItem('authToken');
    const savedUsername = localStorage.getItem('username');
    if (savedToken) {
      setToken(savedToken);
      setCurrentUser(savedUsername);
      setIsAuthenticated(true);
      setShowLogin(false);
    }
    
    // Check for reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setIsResetPassword(true);
      setShowLogin(true);
    }
    
    fetchImages();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage('❌ Please enter username and password');
      return;
    }

    try {
      const response = await axios.post(`${apiUrl}/auth/login`, { username, password });
      const { token: newToken, username: loggedInUser } = response.data;
      
      setToken(newToken);
      setCurrentUser(loggedInUser);
      setIsAuthenticated(true);
      setShowLogin(false);
      localStorage.setItem('authToken', newToken);
      localStorage.setItem('username', loggedInUser);
      setMessage('✅ Login successful!');
      setPassword(''); // Clear password
      setUsername('');
    } catch (error) {
      setMessage(`❌ Login failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      setMessage('❌ Please fill in all fields');
      return;
    }

    try {
      const response = await axios.post(`${apiUrl}/auth/register`, { username, email, password });
      const { token: newToken, username: loggedInUser } = response.data;
      
      setToken(newToken);
      setCurrentUser(loggedInUser);
      setIsAuthenticated(true);
      setShowLogin(false);
      localStorage.setItem('authToken', newToken);
      localStorage.setItem('username', loggedInUser);
      setMessage('✅ Registration successful!');
      setPassword(''); // Clear password
      setEmail('');
      setUsername('');
    } catch (error) {
      setMessage(`❌ Registration failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowLogin(true);
    setUsername('');
    setPassword('');
    setEmail('');
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setMessage('👋 Logged out');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage('❌ Please enter your email');
      return;
    }

    try {
      await axios.post(`${apiUrl}/auth/forgot-password`, { email });
      setMessage('✅ If that email exists, a reset link has been sent. Check your email (or console in dev mode).');
    } catch (error) {
      setMessage(`❌ Error: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleResetPassword = async () => {
    if (!password || !resetToken) {
      setMessage('❌ Please enter a new password');
      return;
    }

    try {
      await axios.post(`${apiUrl}/auth/reset-password`, { token: resetToken, password });
      setMessage('✅ Password reset successful! You can now login.');
      setPassword('');
      setResetToken('');
      setIsResetPassword(false);
      setIsForgotPassword(false);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      setMessage(`❌ Reset failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await axios.get(`${apiUrl}/images`);
      const imagesList = response.data.images || [];
      setImages(imagesList);
      
      // Fetch full details for each image (including base64 data)
      for (const img of imagesList) {
        try {
          const detailResponse = await axios.get(`${apiUrl}/images/${img._id}`);
          setImageDetails(prev => ({
            ...prev,
            [img._id]: detailResponse.data
          }));
        } catch (error) {
          console.error(`Error fetching image ${img._id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImageName(file.name.split('.')[0]);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !imageName) {
      setMessage('Please select a file and enter a name');
      return;
    }

    if (!token) {
      setMessage('❌ Please login first to upload images');
      setShowLogin(true);
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        
        const payload = {
          name: imageName,
          data: base64String,
          contentType: selectedFile.type
        };

        try {
          const response = await axios.post(`${apiUrl}/images`, payload, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          setMessage(`✅ Image uploaded successfully! ID: ${response.data.id}`);
          setSelectedFile(null);
          setPreview(null);
          setImageName('');
          fetchImages();
        } catch (error) {
          if (error.response?.status === 401 || error.response?.status === 403) {
            setMessage(`❌ Authentication failed. Please login again.`);
            handleLogout();
          } else {
            setMessage(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
          }
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📷 Image Uploader</h1>
        <p>Upload and store images in MongoDB</p>
        {isAuthenticated && (
          <div className="user-info">
            <span>👤 {currentUser}</span>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        )}
      </header>

      <main className="App-main">
        {showLogin ? (
          <div className="login-section">
            {isResetPassword ? (
              <>
                <h2>🔑 Reset Password</h2>
                <p>Enter your new password</p>
                <div className="form-group">
                  <label htmlFor="password">New Password:</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="text-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleResetPassword()}
                  />
                </div>
                <div className="password-requirements">
                  <small>Password must contain:</small>
                  <ul>
                    <li>At least 8 characters</li>
                    <li>One uppercase letter (A-Z)</li>
                    <li>One lowercase letter (a-z)</li>
                    <li>One number (0-9)</li>
                  </ul>
                </div>
                <button onClick={handleResetPassword} className="login-button">
                  Reset Password
                </button>
                <button onClick={() => { setIsResetPassword(false); setResetToken(''); window.history.replaceState({}, document.title, window.location.pathname); }} className="toggle-auth-button">
                  Back to Login
                </button>
              </>
            ) : isForgotPassword ? (
              <>
                <h2>🔒 Forgot Password</h2>
                <p>Enter your email to receive a reset link</p>
                <div className="form-group">
                  <label htmlFor="email">Email:</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="text-input"
                    onKeyPress={(e) => e.key === 'Enter' && handleForgotPassword()}
                  />
                </div>
                <button onClick={handleForgotPassword} className="login-button">
                  Send Reset Link
                </button>
                <button onClick={() => { setIsForgotPassword(false); setEmail(''); }} className="toggle-auth-button">
                  Back to Login
                </button>
              </>
            ) : (
              <>
                <h2>🔐 {isRegistering ? 'Create Account' : 'Login Required'}</h2>
                <p>{isRegistering ? 'Register to start uploading images' : 'Please login to upload images'}</p>
                <div className="form-group">
                  <label htmlFor="username">Username:</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="text-input"
                    onKeyPress={(e) => e.key === 'Enter' && (isRegistering ? handleRegister() : handleLogin())}
                  />
                </div>
            {isRegistering && (
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  className="text-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="text-input"
                onKeyPress={(e) => e.key === 'Enter' && (isRegistering ? handleRegister() : handleLogin())}
              />
            </div>
            {isRegistering && (
              <div className="password-requirements">
                <small>Password must contain:</small>
                <ul>
                  <li>At least 8 characters</li>
                  <li>One uppercase letter (A-Z)</li>
                  <li>One lowercase letter (a-z)</li>
                  <li>One number (0-9)</li>
                </ul>
              </div>
            )}
            <button onClick={isRegistering ? handleRegister : handleLogin} className="login-button">
              {isRegistering ? 'Register' : 'Login'}
            </button>
            {!isRegistering && (
              <button onClick={() => setIsForgotPassword(true)} className="forgot-password-button">
                Forgot Password?
              </button>
            )}
            <button onClick={() => setIsRegistering(!isRegistering)} className="toggle-auth-button">
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </button>
          </>
            )}
          </div>
        ) : (
          <div className="upload-section">
            <h2>Upload New Image</h2>
            <div className="auth-status">
              ✅ Authenticated
            </div>
          
          <div className="form-group">
            <label htmlFor="file-input" className="file-label">
              Choose Image
            </label>
            <input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="file-input"
            />
          </div>

          {preview && (
            <div className="preview-section">
              <h3>Preview:</h3>
              <img src={preview} alt="Preview" className="preview-image" />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="image-name">Image Name:</label>
            <input
              id="image-name"
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="Enter image name"
              className="text-input"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload Image'}
          </button>

          {message && (
            <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>
        )}

        <div className="images-section">
          <h2>Uploaded Images ({images.length})</h2>
          <div className="images-grid">
            {images.map((image) => {
              const detail = imageDetails[image._id];
              const imageSrc = detail ? `data:${detail.contentType};base64,${detail.data}` : null;
              
              return (
                <div key={image._id} className="image-card">
                  {imageSrc && (
                    <img src={imageSrc} alt={image.name} className="thumbnail-image" />
                  )}
                  <h4>{image.name}</h4>
                  <p className="image-meta">
                    Type: {image.contentType}<br />
                    Uploaded: {new Date(image.createdAt).toLocaleString()}
                  </p>
                  <a 
                    href={`${apiUrl}/images/${image._id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="view-link"
                  >
                    View JSON
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="App-footer">
        <p>Powered by React + Node.js + MongoDB + Jenkins</p>
      </footer>
    </div>
  );
}

export default App;
