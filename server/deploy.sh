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

# Lambda runtime env vars (always sourced from server/.env)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

export SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-}"
export SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
export SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-}"
export SUPABASE_DB_USER="${SUPABASE_DB_USER:-}"
export SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-}"
export SUPABASE_DB_SSLMODE="${SUPABASE_DB_SSLMODE:-require}"

export SECRET_KEY="${SECRET_KEY:-}"
export S3_BUCKET_NAME="${S3_BUCKET_NAME:-travel-map-media}"
export SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-}"
export SUPABASE_URL="${SUPABASE_URL:-https://ugfjmyzaxkndqhlebqbx.supabase.co}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export CLIENT_APP_URLS="http://localhost:3000,https://travel-map-nine.vercel.app"

for required_var in SUPABASE_DB_HOST SUPABASE_DB_NAME SUPABASE_DB_USER SUPABASE_DB_PASSWORD SECRET_KEY SUPABASE_JWT_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [[ -z "${!required_var}" ]]; then
    echo "Missing required env var: ${required_var}"
    exit 1
  fi
done

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

echo "Waiting for code update to complete..."
aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} \
  --region ${AWS_REGION}

echo "Updating Lambda environment variables..."
ENV_JSON=$(jq -n \
  --arg db_host "$SUPABASE_DB_HOST" \
  --arg db_port "$SUPABASE_DB_PORT" \
  --arg db_name "$SUPABASE_DB_NAME" \
  --arg db_user "$SUPABASE_DB_USER" \
  --arg db_password "$SUPABASE_DB_PASSWORD" \
  --arg db_sslmode "$SUPABASE_DB_SSLMODE" \
  --arg secret_key "$SECRET_KEY" \
  --arg s3_bucket "$S3_BUCKET_NAME" \
  --arg jwt_secret "$SUPABASE_JWT_SECRET" \
  --arg supabase_url "$SUPABASE_URL" \
  --arg service_role_key "$SUPABASE_SERVICE_ROLE_KEY" \
  --arg client_app_urls "$CLIENT_APP_URLS" \
  '{Variables: {SUPABASE_DB_HOST: $db_host, SUPABASE_DB_PORT: $db_port, SUPABASE_DB_NAME: $db_name, SUPABASE_DB_USER: $db_user, SUPABASE_DB_PASSWORD: $db_password, SUPABASE_DB_SSLMODE: $db_sslmode, SECRET_KEY: $secret_key, S3_BUCKET_NAME: $s3_bucket, SUPABASE_JWT_SECRET: $jwt_secret, SUPABASE_URL: $supabase_url, SUPABASE_SERVICE_ROLE_KEY: $service_role_key, CLIENT_APP_URLS: $client_app_urls}}')
aws lambda update-function-configuration \
  --function-name ${FUNCTION_NAME} \
  --region ${AWS_REGION} \
  --environment "${ENV_JSON}"

echo "Waiting for configuration update to complete..."
aws lambda wait function-updated \
  --function-name ${FUNCTION_NAME} \
  --region ${AWS_REGION}

echo "Deployment complete!"