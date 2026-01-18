# Jenkins Test Node.js App

A simple Node.js application for testing Jenkins CI/CD pipeline.

## Features

- Express.js web server
- Health check endpoint
- Simple unit tests
- Docker containerization
- Jenkins pipeline configuration

## Local Testing

### Install dependencies
```bash
npm install
```

### Run tests
```bash
npm test
```

### Run locally
```bash
npm start
```

### Access the app
- Main endpoint: http://localhost:3000
- Health check: http://localhost:3000/health

## Jenkins Pipeline

The `Jenkinsfile` includes these stages:
1. **Checkout** - Get source code
2. **Install Dependencies** - Run npm install
3. **Run Tests** - Execute test suite
4. **Build Docker Image** - Create container image
5. **Deploy Container** - Run the container on port 3000
6. **Verify Deployment** - Health check

## Deploy with Jenkins

1. Create a new Pipeline job in Jenkins
2. Point it to this repository
3. Jenkins will automatically use the Jenkinsfile
4. Run the build
5. Access your app at http://localhost:3000
