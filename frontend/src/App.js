import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [facingMode, setFacingMode] = useState('environment');
  const [error, setError] = useState(null);

  // Pinch to zoom state
  const [isPinching, setIsPinching] = useState(false);
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialZoom, setInitialZoom] = useState(1);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Get video track for zoom capabilities
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.zoom) {
        const settings = track.getSettings();
        setZoom(settings.zoom || 1);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const applyZoom = async (newZoom) => {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.zoom) {
      const minZoom = capabilities.zoom.min || 1;
      const maxZoom = capabilities.zoom.max || 10;
      const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

      try {
        await track.applyConstraints({
          advanced: [{ zoom: clampedZoom }]
        });
        setZoom(clampedZoom);
      } catch (err) {
        console.error('Error applying zoom:', err);
      }
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const distance = getDistance(e.touches[0], e.touches[1]);
      setInitialDistance(distance);
      setInitialZoom(zoom);
    }
  };

  const handleTouchMove = (e) => {
    if (isPinching && e.touches.length === 2) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance;
      const newZoom = initialZoom * scale;
      applyZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsPinching(false);
  };

  const getDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/png');
    setCapturedImage(imageDataUrl);
  };

  const downloadPhoto = () => {
    if (!capturedImage) return;

    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = `photo_${Date.now()}.png`;
    link.click();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}
      
      {!capturedImage ? (
        <div 
          className="camera-container"        
               onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}

        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="video-feed"

          />
          
          <div className="controls">
            <button className="control-btn" onClick={switchCamera}>
              🔄
            </button>
            
            <button className="capture-btn" onClick={capturePhoto}>
              📷
            </button>
            
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={() => applyZoom(zoom - 0.5)}>
                -
              </button>
              <span className="zoom-level">{zoom.toFixed(1)}x</span>
              <button className="zoom-btn" onClick={() => applyZoom(zoom + 0.5)}>
                +
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="preview-container">
          <img src={capturedImage} alt="Captured" className="captured-image" />
          
          <div className="preview-controls">
            <button className="preview-btn" onClick={retakePhoto}>
              Retake
            </button>
            <button className="preview-btn download" onClick={downloadPhoto}>
              Download
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;
