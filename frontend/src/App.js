import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]);
  const [imageDetails, setImageDetails] = useState({});
  const [apiUrl] = useState(process.env.REACT_APP_API_URL || 'http://localhost:3000');

  useEffect(() => {
    fetchImages();
  }, []);

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
          const response = await axios.post(`${apiUrl}/images`, payload);
          setMessage(`✅ Image uploaded successfully! ID: ${response.data.id}`);
          setSelectedFile(null);
          setPreview(null);
          setImageName('');
          fetchImages();
        } catch (error) {
          setMessage(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
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
      </header>

      <main className="App-main">
        <div className="upload-section">
          <h2>Upload New Image</h2>
          
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
