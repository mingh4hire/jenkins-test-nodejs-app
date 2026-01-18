# Jenkins Test Node.js App

A simple Node.js application with MongoDB for testing Jenkins CI/CD pipeline.

## Features

- Express.js web server
- MongoDB integration for storing base64-encoded images
- Health check endpoint
- RESTful API for image storage
- Docker containerization
- Jenkins pipeline configuration

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check with database status
- `POST /images` - Upload a base64-encoded image
- `GET /images` - List all images (metadata only)
- `GET /images/:id` - Get specific image with data

## Local Testing

### Install dependencies
```bash
npm install
```

### Run with MongoDB (requires MongoDB running)
```bash
export MONGO_URI=mongodb://localhost:27017/imagesdb
npm start
```

### Access the app
- Main endpoint: http://localhost:3000
- Health check: http://localhost:3000/health

### Example: Upload an Image
```bash
curl -X POST http://localhost:3000/images \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-image",
    "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "contentType": "image/png"
  }'
```

## Jenkins Pipeline

The `Jenkinsfile` includes these stages:
1. **Checkout** - Get source code
2. **Build Docker Image** - Create container image
3. **Deploy Container** - Run the container on port 3000 with MongoDB connection
4. **Verify Deployment** - Health check

## Deploy with Jenkins

1. Ensure MongoDB is running (see docker-compose.yml in jenkins folder)
2. Create a new Pipeline job in Jenkins
3. Point it to this repository
4. Jenkins will automatically use the Jenkinsfile
5. Run the build
6. Access your app at http://localhost:3000
