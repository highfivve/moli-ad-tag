pipeline {
    agent any

    environment {
        CI = "jenkins"
        PATH = "${WORKSPACE}/node_modules/.bin/:${PATH}"
        HDFS_PATH_API_DOCS = "/mesos/moli/api-docs/${BUILD_NUMBER}"
        HDFS_PATH_DEBUG = "/mesos/moli/debug/${BUILD_NUMBER}"
        DOCS_FILE = "docs.tar.gz"
        DEBUG_DIST = "debug-dist.tar.gz"
    }

    tools {
        nodejs 'nodejs-10.10.0'
    }

    options {
        // only keep 5 builds around
        buildDiscarder logRotator(artifactDaysToKeepStr: '', artifactNumToKeepStr: '', daysToKeepStr: '', numToKeepStr: '20')
        disableConcurrentBuilds()
        timeout(activity: true, time: 15)
    }


    stages {
        stage('Prepare environment') {
            steps {
                echo "Setting up yarn and install dependencies"
                sh "npm install yarn@1.19.2"
                // fresh install
                sh "yarn install"
            }
        }
        stage('Lint') {
            steps {
                sh "yarn workspace @highfivve/ad-tag lint"
            }
        }
        stage('Compile') {
            steps {
                sh "yarn workspace @highfivve/ad-tag compile"
            }
        }
        stage('Test') {
            steps {
                sh "yarn workspace @highfivve/ad-tag test:junit"
            }
        }
        stage('Modules') {
            steps {
                script {
                    // a map with one entry for every module
                    def modules = [:]

                    ['confiant', 'justpremium-skin', 'generic-skin', 'prebid-google-analytics', 'sovrn-ad-reload', 'cmp-faktor', 'cmp-generic', 'cmp-static', 'cmp-sourcepoint', 'blocklist-url'].each { module ->
                        modules[module] = {
                            stage('validate') {
                                echo "Running validate:jenkins for module $module"
                                sh "yarn workspace @highfivve/module-$module validate:jenkins"
                            }
                        }
                    }

                    parallel modules
                }
            }
        }

        stage('Deployment') {
            parallel {
                stage('Examples') {
                    steps {
                        sh "yarn workspaces run validate"
                    }
                }

                stage('API docs') {
                    steps {
                        sh "yarn workspace @highfivve/ad-tag docs"
                        sh "tar -zcvf ${DOCS_FILE} -C ad-tag/docs ."
                        echo "Publishing to ${HDFS_PATH_API_DOCS}"
                        sh "/usr/local/bin/httpfs put ${DOCS_FILE} ${HDFS_PATH_API_DOCS}"
                        sh "aurora2 update start --wait --bind=hdfsPath=${HDFS_PATH_API_DOCS} --bind=docsFile=${DOCS_FILE}  gfaurora/frontend/prod/moli-api-docs docs.aurora"
                    }
                }

                stage('Moli debug') {
                    steps {
                        sh "yarn workspace @highfivve/moli-debugger build"
                        sh "tar -zcvf ${DEBUG_DIST} -C moli-debugger/dist ."
                        echo "Publishing to ${HDFS_PATH_DEBUG}"
                        sh "/usr/local/bin/httpfs put ${DEBUG_DIST} ${HDFS_PATH_DEBUG}"
                        sh "aurora2 update start --wait --bind=hdfsPath=${HDFS_PATH_DEBUG} --bind=distFile=${DEBUG_DIST}  gfaurora/frontend/prod/moli-debug moli-debugger.aurora"
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
