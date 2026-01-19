const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/imagesdb';
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';
const API_KEY = process.env.API_KEY || 'default-api-key';

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' })); // Allow large base64 images

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// API Key Middleware (simpler alternative)
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Valid API key required' });
  }
  
  next();
};
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

// User Schema
const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastLogin: {
    type: Date
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use Gmail with app password
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASS  // Your 16-character app password
  }
});

// Send real emails if EMAIL_USER is configured (works in dev and production)
const sendEmail = async (to, subject, html) => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Send real email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html
      });
      console.log(`📧 Email sent to ${to}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      throw error;
    }
  } else {
    // Log email if credentials not configured
    console.log('\n📧 Email would be sent to:', to);
    console.log('Subject:', subject);
    console.log('Body:', html);
    console.log('---\n');
    console.log('⚠️  To send real emails, configure EMAIL_USER and EMAIL_PASS in .env');
  }
};

// Routes

// Password validation helper
const validatePassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain uppercase, lowercase, and number
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input or user already exists
 */
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.username === username 
          ? 'Username already taken' 
          : 'Email already registered' 
      });
    }
    
    // Create new user (password will be hashed by pre-save hook)
    const user = new User({
      username,
      email,
      password,
      role: 'user' // Default role
    });
    
    await user.save();
    
    // Send welcome email
    const welcomeEmailHtml = `
      <h2>Welcome to Image Uploader! 🎉</h2>
      <p>Hi <strong>${user.username}</strong>,</p>
      <p>Your account has been successfully created!</p>
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Account Details:</strong></p>
        <p>📧 Email: ${user.email}</p>
        <p>👤 Username: ${user.username}</p>
        <p>🔑 Role: ${user.role}</p>
      </div>
      <p>You can now login and start uploading images at:</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost'}" style="display: inline-block; padding: 10px 20px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px;">Go to Image Uploader</a>
      <p style="margin-top: 20px;">If you didn't create this account, please contact support immediately.</p>
      <p>Happy uploading! 📷</p>
    `;
    
    await sendEmail(user.email, 'Welcome to Image Uploader!', welcomeEmailHtml);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username, 
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(201).json({ 
      message: 'Registration successful',
      token,
      username: user.username,
      email: user.email,
      role: user.role,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to get API token
 *     description: Get a JWT token for API access using username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       401:
 *         description: Invalid credentials
 */
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Find user by username or email
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Compare passwords using bcrypt
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username, 
        role: user.role 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      message: 'Login successful',
      token,
      username: user.username,
      email: user.email,
      role: user.role,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email with token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset email sent
 *       404:
 *         description: Email not found
 */
app.post('/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // Send email with reset link
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost'}/reset-password?token=${resetToken}`;
    const emailHtml = `
      <h2>Password Reset Request</h2>
      <p>Hi ${user.username},</p>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>Or copy this link: ${resetUrl}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    
    await sendEmail(user.email, 'Password Reset Request', emailHtml);
    
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Reset user password using reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
app.post('/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.message });
    }
    
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Update password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    // Send confirmation email
    await sendEmail(
      user.email,
      'Password Changed Successfully',
      `<h2>Password Changed</h2><p>Hi ${user.username},</p><p>Your password has been successfully changed.</p><p>If you didn't make this change, please contact support immediately.</p>`
    );
    
    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

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
app.post('/images', authenticateToken, async (req, res) => {
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
