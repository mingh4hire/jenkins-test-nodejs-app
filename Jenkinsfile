pipeline {
    agent any
    
    environment {
        BACKEND_IMAGE = "jenkins-test-nodejs-app-backend"
        FRONTEND_IMAGE = "jenkins-test-nodejs-app-frontend"
        IMAGE_TAG = "${BUILD_NUMBER}"
        JWT_SECRET = credentials('JWT_SECRET')    
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
                    sh "docker tag ${FRONTEND_IMAGE}:${IMAGE_TAG} ${FRONTEND_IMAGE}:latest"
                }
            }
        }
        
        stage('Deploy Containers') {
            steps {
                echo 'Deploying containers...'
                script {
                    // Stop and remove old containers by name (if exist)
                    sh """
                        docker stop ${BACKEND_IMAGE} ${FRONTEND_IMAGE} jenkins-test-nodejs-app || true
                        docker rm ${BACKEND_IMAGE} ${FRONTEND_IMAGE} jenkins-test-nodejs-app || true
                    """
                    
                    // Also stop any containers using the ports
                    sh """
                        docker ps --filter "publish=3000" -q | xargs -r docker stop || true
                        docker ps --filter "publish=80" -q | xargs -r docker stop || true
                        docker ps -a --filter "publish=3000" -q | xargs -r docker rm || true
                        docker ps -a --filter "publish=80" -q | xargs -r docker rm || true
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
                            ${FRONTEND_IMAGE}:latest
                    """
                }
            }
        }
        
        // stage('Verify Deployment') {
        //     steps {
        //         echo 'Verifying deployment...'
        //         script {
        //             sleep 5
        //             sh 'curl -f http://localhost:3000/health || exit 1'
        //             echo 'Deployment verified successfully!'
        //         }
        //     }
        // }
    }
    
    post {
        success {
            echo 'Pipeline completed successfully!'
            echo "Backend API is running at: http://localhost:3000"
            echo "Frontend is running at: http://localhost"
            echo "Swagger API docs at: http://localhost:3000/api-docs"
        }
        failure {
            echo 'Pipeline failed!'
            script {
                sh "docker logs ${BACKEND_IMAGE} || true"
                sh "docker logs ${FRONTEND_IMAGE} || true"
            }
        }
    }
}
