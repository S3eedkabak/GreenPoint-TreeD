pipeline {
    agent any

    environment {
        NODE_VERSION = '20.x'
        NPM_CONFIG_CACHE = "${WORKSPACE}/.npm"
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Setup Node.js') {
            steps {
                echo 'Setting up Node.js environment...'
                sh '''
                    node --version
                    npm --version
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing project dependencies...'
                sh 'npm ci'
            }
        }

        stage('Run Tests') {
            steps {
                echo 'Running tree addition tests...'
                sh 'node src/__tests__/Add_tree_test.js'
            }
        }

        stage('Build Report') {
            steps {
                echo 'Build completed successfully!'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
            echo 'All tests passed.'
        }

        failure {
            echo 'Pipeline failed!'
            echo 'Check the test results above.'
        }

        always {
            echo 'Cleaning up workspace...'
            cleanWs()
        }
    }
}