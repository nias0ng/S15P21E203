pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    environment {
        AI_DIR = 'ai'
        AI_IMAGE = 'hyanghae-ai:latest'
        AI_CONTAINER = 'hyanghae-ai'
        BACKEND_DIR = 'backend'
        BACKEND_IMAGE = 'hyanghae-backend:latest'
        FRONTEND_DIR = 'frontend'
        FRONTEND_DEPLOY_DIR = '/var/www/hyanghae'
        VITE_API_BASE_URL = '/api/v1'
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

        stage('Frontend Build') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'master'
                }
            }
            steps {
                sh '''
                    set -eu
                    docker run --rm \
                        --user "$(id -u):$(id -g)" \
                        --volume "$WORKSPACE/$FRONTEND_DIR:/workspace" \
                        --workdir /workspace \
                        --env VITE_API_BASE_URL="$VITE_API_BASE_URL" \
                        --env VITE_GOOGLE_LOGIN_ENABLED="${VITE_GOOGLE_LOGIN_ENABLED:-false}" \
                        --env npm_config_cache=/tmp/npm-cache \
                        node:22-bookworm-slim \
                        sh -c 'npm ci && npm run build'
                '''
            }
        }

        stage('Docker Images Build') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    docker build --tag "$BACKEND_IMAGE" "$BACKEND_DIR"
                    docker build --tag "$AI_IMAGE" "$AI_DIR"
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

        stage('Frontend Deploy') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu
                    test -d "$FRONTEND_DIR/dist" || {
                        echo "$FRONTEND_DIR/dist does not exist." >&2
                        exit 1
                    }
                    test -d "$FRONTEND_DEPLOY_DIR" || {
                        echo "$FRONTEND_DEPLOY_DIR does not exist." >&2
                        exit 1
                    }
                    test -w "$FRONTEND_DEPLOY_DIR" || {
                        echo "$FRONTEND_DEPLOY_DIR is not writable by the Jenkins user." >&2
                        exit 1
                    }
                    command -v rsync >/dev/null 2>&1 || {
                        echo "rsync is not installed on the Jenkins agent." >&2
                        exit 1
                    }
                    rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_DEPLOY_DIR/"
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
                        --retry-all-errors \
                        --max-time 5 \
                        "$HEALTH_CHECK_URL"
                '''
            }
        }

        stage('AI Health Check') {
            when {
                branch 'master'
            }
            steps {
                sh '''
                    set -eu

                    attempts=12
                    while [ "$attempts" -gt 0 ]; do
                        status="$(docker inspect \
                            --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
                            "$AI_CONTAINER" 2>/dev/null || true)"

                        case "$status" in
                            healthy)
                                exit 0
                                ;;
                            unhealthy)
                                docker logs --tail 100 "$AI_CONTAINER" || true
                                exit 1
                                ;;
                        esac

                        attempts=$((attempts - 1))
                        sleep 5
                    done

                    echo "$AI_CONTAINER did not become healthy." >&2
                    docker logs --tail 100 "$AI_CONTAINER" || true
                    exit 1
                '''
            }
        }
    }
}
