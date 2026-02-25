pipeline {
    agent any

    environment {
        // Keep these for record, though Docker will use its own internal Node
        NODE_VERSION = '20.x'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Creating the Docker Image...'
                // This builds the environment using your Dockerfile
                sh 'docker build -t treed-app-image .'
            }
        }

        stage('Run Tests in Docker') {
            steps {
                echo 'Running tests inside the Docker container...'
                // This replaces 'npm ci' and the 'node src/...' commands
                // It runs them inside the isolated container
                sh 'docker run --rm treed-app-image node src/__tests__/Add_tree_test.js'
                sh 'docker run --rm treed-app-image node src/__tests__/CSV_import_export_test.mjs'
            }
        }

        stage('Build Report') {
            steps {
                echo 'Build completed successfully in Docker!'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
            echo 'All containerized tests passed.'
        }

        failure {
            echo 'Pipeline failed!'
            echo 'Check Docker logs above.'
        }

        always {
            echo 'Cleaning up Docker images and workspace...'
            // This prevents your VM disk from filling up with old images
            sh 'docker image prune -f'
            cleanWs()
        }
    }
}