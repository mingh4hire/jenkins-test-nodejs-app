pipeline {
    agent any
    
    environment {
        BACKEND_IMAGE = "jenkins-test-nodejs-app-backend"
        FRONTEND_IMAGE = "jenkins-test-nodejs-app-frontend"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Source code checked out'
            }
        }
        
        stage('Build Docker Images') {
            steps {
                echo 'Building Docker images...'
                script {
                    // Build backend image
                    sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} ."
                    sh "docker tag ${BACKEND_IMAGE}:${IMAGE_TAG} ${BACKEND_IMAGE}:latest"
                    
                    // Build frontend image
                    sh "docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ./frontend"
                    sh "docker s') {
            steps {
                echo 'Deploying containers...'
                script {
                    // Stop and remove old containers if exist
                    sh """
                        docker stop ${BACKEND_IMAGE} ${FRONTEND_IMAGE} || true
                        docker rm ${BACKEND_IMAGE} ${FRONTEND_IMAGE} || true
                    """
                    
                    // Run backend container
                    sh """
                        docker run -d \
                            --name ${BACKEND_IMAGE} \
                            --network jenkins_jenkins \
                            --network-alias backend \
                            -e MONGO_URI=mongodb://mongodb:27017/imagesdb \
                            -p 3000:3000 \
                            ${BACKEND_IMAGE}:latest
                    """
                    
                    // Run frontend container
                    sh """
                        docker run -d \
                            --name ${FRONTEND_IMAGE} \
                            --network jenkins_jenkins \
                            -p 80:80 \
                            ${FRONTEND_IMAG
                            --name ${IMAGE_NAME} \
                            --network jenkins_jenkins \
                            -e MONGO_URI=mongodb://mongodb:27017/imagesdb \
                            -p 3000:3000 \
                            ${IMAGE_NAME}:latest
                    """
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                echo 'Verifying deployment...'
                script {
                    sleep 5
                  Backend API is running at: http://localhost:3000"
            echo "Frontend is running at: http://localhost"
            echo "Swagger API docs at: http://localhost:3000/api-docs"
        }
        failure {
            echo 'Pipeline failed!'
            script {
                sh "docker logs ${BACKEND_IMAGE} || true"
                sh "docker logs ${FRONTEND_IMAG
    
    post {
        success {
            echo 'Pipeline completed successfully!'
            echo "App is running at: http://localhost:3000"
        }
        failure {
            echo 'Pipeline failed!'
            script {
                sh "docker logs ${IMAGE_NAME} || true"
            }
        }
    }
}
