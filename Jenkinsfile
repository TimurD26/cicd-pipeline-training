/**
 * Multibranch Pipeline job name in Jenkins: "CICD"
 *
 * Jenkins auto-discovers this Jenkinsfile on every branch of the repo
 * (main, dev, and any future branch). Each branch is treated as its own
 * "environment": the port, docker image tag and logo.svg used are picked
 * based on env.BRANCH_NAME, which Jenkins sets automatically for
 * multibranch jobs.
 *
 * Required Jenkins config before this runs (see README.md):
 *  - Plugins: Docker Pipeline, Docker plugin, Git plugin, Pipeline, NodeJs plugin
 *  - Manage Jenkins > Tools > NodeJS installations > name it "Node 7.8.0"
 *    (or update the `tools { nodejs '...' }` block below to match your name)
 *  - Jenkins agent has Docker installed and the jenkins user can run docker
 */
pipeline {
    agent any

    tools {
        nodejs 'Node 7.8.0'
    }

    environment {
        // Populated in the "Set environment" stage below.
        APP_PORT       = ''
        IMAGE_NAME     = ''
        CONTAINER_NAME = ''
        LOGO_FILE      = ''
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Set environment') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        env.APP_PORT       = '3000'
                        env.IMAGE_NAME     = 'nodemain:v1.0'
                        env.CONTAINER_NAME = 'node-main'
                        env.LOGO_FILE      = 'logos/logo-main.svg'
                    } else if (env.BRANCH_NAME == 'dev') {
                        env.APP_PORT       = '3001'
                        env.IMAGE_NAME     = 'nodedev:v1.0'
                        env.CONTAINER_NAME = 'node-dev'
                        env.LOGO_FILE      = 'logos/logo-dev.svg'
                    } else {
                        // Any other/feature branch: safe defaults, own image/container name
                        env.APP_PORT       = '3002'
                        env.IMAGE_NAME     = "node${env.BRANCH_NAME}:v1.0".replaceAll('[^a-zA-Z0-9_.:-]', '-')
                        env.CONTAINER_NAME = "node-${env.BRANCH_NAME}".replaceAll('[^a-zA-Z0-9_.-]', '-')
                        env.LOGO_FILE      = 'logos/logo-dev.svg'
                    }
                    echo "Branch=${env.BRANCH_NAME} -> port=${env.APP_PORT}, image=${env.IMAGE_NAME}, container=${env.CONTAINER_NAME}, logo=${env.LOGO_FILE}"
                }
            }
        }

        stage('Build') {
            steps {
                dir('app') {
                    sh 'npm install'
                }
            }
        }

        stage('Test') {
            steps {
                dir('app') {
                    sh 'npm test'
                }
            }
        }

        stage('Apply branch assets') {
            steps {
                // Swap in the branch-specific logo before the image is built,
                // so the docker image bakes in the right picture per env.
                sh "cp ${env.LOGO_FILE} app/public/logo.svg"
            }
        }

        stage('Build Docker image') {
            steps {
                sh "docker build --build-arg APP_PORT=${env.APP_PORT} -t ${env.IMAGE_NAME} ."
            }
        }

        stage('Deploy') {
            steps {
                script {
                    // Advanced task: only tear down the container for THIS
                    // env/branch, leaving containers from other branches
                    // (e.g. main untouched while deploying dev) running.
                    sh """
                        if [ \$(docker ps -aq -f name=^${env.CONTAINER_NAME}\$) ]; then
                            docker rm -f ${env.CONTAINER_NAME}
                        fi
                    """
                    sh "docker run -d --name ${env.CONTAINER_NAME} -p ${env.APP_PORT}:${env.APP_PORT} -e PORT=${env.APP_PORT} -e APP_ENV=${env.BRANCH_NAME} ${env.IMAGE_NAME}"
                }
            }
        }
    }

    post {
        success {
            echo "Deployed ${env.BRANCH_NAME} -> http://localhost:${env.APP_PORT}"
        }
        failure {
            echo "Pipeline failed for branch ${env.BRANCH_NAME}"
        }
    }
}
