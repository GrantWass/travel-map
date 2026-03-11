#!/usr/bin/env bash
set -e

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
export AWS_REGION=us-east-1
export ACCOUNT_ID=343218212240
export REPO_NAME=travel-map-server
export FUNCTION_NAME=travel-map-server
export IMAGE_TAG=latest
export ROLE_ARN=arn:aws:iam::343218212240:role/lambda-execution-role
export ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"

echo "Deploying ${FUNCTION_NAME} to AWS Lambda..."

# -----------------------------------------------------------------------------
# Login Docker to ECR
# -----------------------------------------------------------------------------
echo "Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} \
  | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# -----------------------------------------------------------------------------
# Build image
# -----------------------------------------------------------------------------
echo "Building Docker image..."
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  --load \
  -f Dockerfile.lambda \
  -t ${ECR_URI}:${IMAGE_TAG} .

# -----------------------------------------------------------------------------
# Push image
# -----------------------------------------------------------------------------
echo "Pushing image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}

# -----------------------------------------------------------------------------
# Update Lambda
# -----------------------------------------------------------------------------
echo "Updating Lambda function..."
aws lambda update-function-code \
  --function-name ${FUNCTION_NAME} \
  --image-uri ${ECR_URI}:${IMAGE_TAG} \
  --region ${AWS_REGION}

echo "Deployment complete!"