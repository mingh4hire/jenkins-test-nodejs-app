pipeline {
    agent any
    
    tools {
        nodejs 'Node18'
    }
    
    environment {
        IMAGE_NAME = "jenkins-test-nodejs-app"
        IMAGE_TAG = "${BUILD_NUMBER}"
        CONTAINER_NAME = "nodejs-app-${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo 'Source code checked out'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                echo 'Installing Node.js dependencies...'
                sh 'npm install'
            }
        }
        
        stage('Run Tests') {
            steps {
                echo 'Running tests...'
                sh 'npm test'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                echo 'Building Docker image...'
                script {
                    sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
                    sh "docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest"
                }
            }
        }
        
        stage('Deploy Container') {
            steps {
                echo 'Deploying container...'
                script {
                    // Stop and remove old container if exists
                    sh """
                        docker ps -a | grep ${IMAGE_NAME} | awk '{print \$1}' | xargs -r docker stop || true
                        docker ps -a | grep ${IMAGE_NAME} | awk '{print \$1}' | xargs -r docker rm || true
                    """
                    
                    // Run new container
                    sh """
                        docker run -d \
                            --name ${IMAGE_NAME} \
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
                    sh 'curl -f http://localhost:3000/health || exit 1'
                    echo 'Deployment verified successfully!'
                }
            }
        }
    }
    
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
