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
                    }
                }
            }
        }
        stage('Lint') {
            steps {
                ansiColor('xterm') {
                    // use the name for the nodejs installation from the 'configure tools' page
                    nodejs('nodejs-10.10.0') {
                        sh "yarn && yarn lint"
                    }
                }
            }
        }
        stage('Compile') {
            steps {
                ansiColor('xterm') {
                    // use the name for the nodejs installation from the 'configure tools' page
                    nodejs('nodejs-10.10.0') {
                        sh "yarn && yarn compile"
                    }
                }
            }
        }
        stage('Test') {
            steps {
                ansiColor('xterm') {
                    // use the name for the nodejs installation from the 'configure tools' page
                    nodejs('nodejs-10.10.0') {
                        sh "yarn && yarn test"
                    }
                }
            }
        }
    }
    post {
        always {
            // FIXME don't allow empty results
            junit allowEmptyResults: true, testResults: '**/test-report.xml'
        }
    }
}