const express = require('express');
const mongoose = require('mongoose');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/imagesdb';

// Swagger Configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jenkins Test Node.js API',
      version: '2.0.0',
      description: 'API for storing and retrieving base64-encoded images in MongoDB',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(express.json({ limit: '50mb' })); // Allow large base64 images
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get API information
 *     description: Returns API version and available endpoints
 *     responses:
 *       200:
 *         description: API information
 */
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from Jenkins deployed Node.js app!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /images': 'Upload a base64 image',
      'GET /images': 'Get all images',
      'GET /images/:id': 'Get specific image',
      'GET /health': 'Health check',
      'GET /api-docs': 'Swagger API documentation'
    }
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check API and database health status
 *     responses:
 *       200:
 *         description: Health status
 */
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'healthy',
    database: dbStatus
  });
});

/**
 * @swagger
 * /images:
 *   post:
 *     summary: Upload a base64-encoded image
 *     description: Store a base64-encoded image in MongoDB
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - data
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the image
 *                 example: my-image
 *               data:
 *                 type: string
 *                 description: Base64-encoded image data
 *                 example: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
 *               contentType:
 *                 type: string
 *                 description: MIME type of the image
 *                 example: image/png
 *     responses:
 *       201:
 *         description: Image saved successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /images:
 *   get:
 *     summary: Get all images
 *     description: Retrieve a list of all images (metadata only, without base64 data)
 *     responses:
 *       200:
 *         description: List of images
 *       500:
 *         description: Server error
 */
app.get('/images', async (req, res) => {
  try {
    const images = await Image.find({}, { data: 0 }).sort({ createdAt: -1 });
    res.json({ count: images.length, images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

/**
 * @swagger
 * /images/{id}:
 *   get:
 *     summary: Get image by ID
 *     description: Retrieve a specific image with full base64 data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the image
 *     responses:
 *       200:
 *         description: Image data
 *       404:
 *         description: Image not found
 *       500:
 *         description: Server error
 */
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
