@Library('jenkins-shared-library') _

pipeline {
    agent any

    environment {
        CI = "jenkins"
        PATH = "${WORKSPACE}/node_modules/.bin/:${PATH}"
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
                      'prebid-google-analytics', 'sovrn-ad-reload', 'blocklist-url', 'prebuilt-ad-tag', 'the-adex-dmp'
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
            markBuildAsSuccessful('MoliAdTag')
        }
        unstable {
            markBuildAsUnstable()
        }
        failure {
            markBuildAsFailed()
        }
        always {
            junit allowEmptyResults: false, testResults: '**/test-results.xml'
        }
    }
}
