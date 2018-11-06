pipeline {
    agent any

    environment {
        CI = "jenkins"
        PATH = "${WORKSPACE}/node_modules/.bin/:${PATH}"
    }

    stages {
        stage('Prepare environment') {
            steps {
                ansiColor('xterm') {
                    // use the name for the nodejs installation from the 'configure tools' page
                    nodejs('nodejs-10.10.0') {
                        echo "Setting up yarn and install dependencies"
                        sh "npm install yarn@1.10.1"
                        sh "yarn install"
                    }
                }
            }
        }
        stage('Lint') {
            steps {
                ansiColor('xterm') {
                    nodejs('nodejs-10.10.0') {
                        sh "yarn lint"
                    }
                }
            }
        }
        stage('Compile') {
            steps {
                ansiColor('xterm') {
                    nodejs('nodejs-10.10.0') {
                        sh "yarn compile"
                    }
                }
            }
        }
        stage('Test') {
            steps {
                ansiColor('xterm') {
                    nodejs('nodejs-10.10.0') {
                        sh "yarn test:junit"
                    }
                }
            }
        }
        stage('Build examples') {
            steps {
                ansiColor('xterm') {
                    nodejs('nodejs-10.10.0') {
                        sh "yarn build:examples"
                    }
                }
            }
        }
    }
    post {
        always {
            junit allowEmptyResults: false, testResults: '**/test-report.xml'
        }
    }
}