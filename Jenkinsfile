pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    environment {
        BACKEND_DIR = 'backend'
        BACKEND_IMAGE = 'hyanghae-backend:latest'
        DEPLOY_DIR = '/home/ubuntu/hyanghae'
        HEALTH_CHECK_URL = 'http://127.0.0.1:8081/actuator/health'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend Build') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'master'
                }
            }
            steps {
                dir("${env.BACKEND_DIR}") {
                    sh '''
                        set -eu
                        test -f ./gradlew || {
                            echo "backend/gradlew does not exist." >&2
                            exit 1
                        }
                        chmod +x ./gradlew
                        ./gradlew clean assemble -x test --no-daemon
                    '''
                }
            }
        }

        stage('Backend Test') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'master'
                }
            }
            steps {
                dir("${env.BACKEND_DIR}") {
                    sh '''
                        set -eu
                        ./gradlew test --no-daemon
                    '''
                }
            }
        }

        stage('Docker Image Build') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    docker build --tag "$BACKEND_IMAGE" "$BACKEND_DIR"
                '''
            }
        }

        stage('Deploy') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    test -f "$DEPLOY_DIR/compose.yaml" || {
                        echo "$DEPLOY_DIR/compose.yaml does not exist." >&2
                        exit 1
                    }
                    test -f "$DEPLOY_DIR/.env" || {
                        echo "$DEPLOY_DIR/.env does not exist." >&2
                        exit 1
                    }
                    cd "$DEPLOY_DIR"
                    docker compose -f compose.yaml up -d
                '''
            }
        }

        stage('Backend Health Check') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    curl \
                        --fail \
                        --silent \
                        --show-error \
                        --retry 12 \
                        --retry-delay 5 \
                        --retry-connrefused \
                        --max-time 5 \
                        "$HEALTH_CHECK_URL"
                '''
            }
        }
    }
}
