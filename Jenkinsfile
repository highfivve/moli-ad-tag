pipeline {
    agent any

    environment {
        CI = "jenkins"
        PATH = "${WORKSPACE}/node_modules/.bin/:${PATH}"
        HDFS_PATH_API_DOCS = "/mesos/moli/api-docs/${BUILD_NUMBER}"
        DOCS_FILE = "docs.tar.gz"
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
                        // remove the symlink created in yarn install
                        sh "yarn unlink"
                    }
                }
            }
        }
        stage('API docs') {
            steps {
                ansiColor('xterm') {
                    nodejs('nodejs-10.10.0') {
                        sh "yarn docs"
                        sh "tar -zcvf ${DOCS_FILE} -C docs ."
                        echo "Publishing to ${HDFS_PATH_API_DOCS}"
                        sh "httpfs-cdh5 put ${DOCS_FILE} ${HDFS_PATH_API_DOCS}"
                        sh "aurora2 update start --wait --bind=hdfsPath=${HDFS_PATH_API_DOCS} --bind=docsFile=${DOCS_FILE}  gfaurora/frontend/prod/moli-api-docs docs.aurora"
                    }
                }
            }
        }
    }
    post {
        always {
            junit allowEmptyResults: false, testResults: '**/test-results.xml'
        }
    }
}