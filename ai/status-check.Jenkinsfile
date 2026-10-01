// 향수 단종 점검 (반자동). 매달 1일 새벽에 돌아 후보 보고서를 빌드 산출물로 남깁니다.
//
// 단종 목록(ai/data/perfume_status.csv)은 고치지 않습니다 — 사람이 보고서를 검토해 커밋합니다.
// 배포 파이프라인(루트 Jenkinsfile)과 따로 등록합니다. 한 번만:
//
//   새 Item > Pipeline
//   Pipeline > Definition: Pipeline script from SCM · SCM: Git (배포 작업과 같은 저장소 · 자격 증명)
//   Branch Specifier: */develop
//   Script Path: ai/status-check.Jenkinsfile
//
// 저장하고 '지금 빌드' 를 한 번 누르면 아래 cron 이 등록됩니다. 결과는 빌드 화면의
// '빌드 산출물' 에서 report.md 부터 봅니다. 검토 방법은 ai/README.md 의 '단종 점검'.

pipeline {
    agent any

    triggers {
        cron('H 4 1 * *')
    }

    options {
        disableConcurrentBuilds()
        timeout(time: 3, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '12'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Status Check') {
            steps {
                // 표준 라이브러리만 쓰므로 pip 설치 없이 python 이미지에서 바로 돕니다
                sh '''
                    set -eu
                    rm -rf ai/logs/status_check/latest
                    docker run --rm \
                        --user "$(id -u):$(id -g)" \
                        --volume "$WORKSPACE/ai:/work" \
                        --workdir /work \
                        --env PYTHONIOENCODING=utf-8 \
                        python:3.12-slim \
                        python perfume_status_check.py --out logs/status_check/latest
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'ai/logs/status_check/latest/**', allowEmptyArchive: true
        }
    }
}
