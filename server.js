const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/imagesdb';

// Middleware
app.use(express.json({ limit: '50mb' })); // Allow large base64 images

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Image Schema
const imageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  data: { type: String, required: true }, // Base64 encoded image
  contentType: { type: String, default: 'image/png' },
  createdAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', imageSchema);

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from Jenkins deployed Node.js app!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /images': 'Upload a base64 image',
      'GET /images': 'Get all images',
      'GET /images/:id': 'Get specific image',
      'GET /health': 'Health check'
    }
  });
});

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'healthy',
    database: dbStatus
  });
});

// POST endpoint to save base64 image
app.post('/images', async (req, res) => {
  try {
    const { name, data, contentType } = req.body;
    
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data (base64) are required' });
    }

    const image = new Image({
      name,
      data,
      contentType: contentType || 'image/png'
    });

    await image.save();
    
    res.status(201).json({ 
      message: 'Image saved successfully',
      id: image._id,
      name: image.name,
      createdAt: image.createdAt
    });
  } catch (error) {
    console.error('Error saving image:', error);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

// GET all images (metadata only)
app.get('/images', async (req, res) => {
  try {
    const images = await Image.find({}, { data: 0 }).sort({ createdAt: -1 });
    res.json({ count: images.length, images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// GET specific image by ID
app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`MongoDB URI: ${MONGO_URI}`);
});
