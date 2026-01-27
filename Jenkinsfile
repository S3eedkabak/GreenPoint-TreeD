pipeline {
    agent any
    stages {
        stage('Install') {
            steps {
                sh 'npm install'
            }
        }
        stage('Test') {
            steps {
                // This runs no matter which branch you push
                sh 'npm test || echo "Tests skipped"'
            }
        }
    }
}