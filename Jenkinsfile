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
        nodejs 'nodejs-16.4.0'
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
                sh "rm -rf node_modules/"
                // fresh install
                sh "yarn install && yarn setup:all"
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
        stage('make:nodemodule') {
          steps {
            sh "yarn workspace @highfivve/ad-tag make:nodemodule"
          }
        }
        stage('Modules') {
            steps {
                script {
                    // a map with one entry for every module
                    def modules = [:]

                    [
                      'moli-ad-reload', 'confiant', 'generic-skin', 'identitylink', 'zeotap', 'pubstack', 'yield-optimization',
                      'prebid-google-analytics', 'sovrn-ad-reload', 'blocklist-url', 'prebuilt-ad-tag'
                    ].each { module ->
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
                        dir('website') {
                            sh "yarn install"
                            sh "yarn build"
                            sh "tar -zcvf ${DOCS_FILE} -C build ."
                            echo "Publishing to ${HDFS_PATH_API_DOCS}"
                            sh "/usr/local/bin/httpfs put ${DOCS_FILE} ${HDFS_PATH_API_DOCS}"
                        }
                        sh "aurora2 update start --wait --bind=hdfsPath=${HDFS_PATH_API_DOCS} --bind=docsFile=${DOCS_FILE}  gfaurora/frontend/prod/moli-api-docs docs.aurora"
                    }
                }

                stage('Moli debug') {
                    steps {
                        sh "yarn workspace @highfivve/moli-debugger build:prod"
                        sh "tar -zcvf ${DEBUG_DIST} -C moli-debugger/lib ."
                        echo "Publishing to ${HDFS_PATH_DEBUG}"
                        sh "/usr/local/bin/httpfs put ${DEBUG_DIST} ${HDFS_PATH_DEBUG}"
                        sh "aurora2 update start --wait --bind=hdfsPath=${HDFS_PATH_DEBUG} --bind=distFile=${DEBUG_DIST}  gfaurora/frontend/prod/moli-debug moli-debugger.aurora"
                    }
                }

                stage('Prebuilt AdTag') {
                    steps {
                        script {
                            def packageJSON = readJSON file: 'prebuilt/ad-tag/package.json'
                            packageJSONVersion = packageJSON.version
                        }
                        withAWS(endpointUrl: 'https://minio.gutefrage.net', credentials: 'minio') {
                            echo 'starting upload to minio'
                            s3Upload(
                                workingDir: 'prebuilt/ad-tag/dist/',
                                includePathPattern: '*.js',
                                excludePathPattern: 'latest.js',
                                bucket: "assets.h5v.eu",
                                path: "prebuilt/ad-tag/",
                                pathStyleAccessEnabled: true,
                                cacheControl: 'public,max-age=31536000,immutable',
                                contentType: 'text/javascript;charset=utf-8'
                            )
                            s3Upload(
                                file: 'prebuilt/ad-tag/dist/latest.js',
                                bucket: "assets.h5v.eu",
                                path: "prebuilt/ad-tag/latest.js",
                                pathStyleAccessEnabled: true,
                                contentType: 'text/javascript;charset=utf-8'
                            )
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            slackSend color: 'good',
                    message: "built moli ad tag ${BUILD_NUMBER} (<${BUILD_URL}|jenkins build>)"
        }
        unstable {
            slackSend color: 'warning',
                    message: "build is unstable for moli ad tag ${BUILD_NUMBER} (<${BUILD_URL}|jenkins build>)"
        }
        failure {
            slackSend color: 'danger',
                    message: "build failed for moli ad tag ${BUILD_NUMBER} (<${BUILD_URL}|jenkins build>)"
        }
        always {
            junit allowEmptyResults: false, testResults: '**/test-results.xml'
        }
    }
}
