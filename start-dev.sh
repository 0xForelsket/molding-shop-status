#!/bin/bash
set -e

# Create network if it doesn't exist
podman network exists molding-net || podman network create molding-net

# Start Postgres
echo "Starting Postgres..."
podman run -d \
  --name molding-db \
  --network molding-net \
  -p 5432:5432 \
  -e POSTGRES_USER=molding \
  -e POSTGRES_PASSWORD=molding_secret \
  -e POSTGRES_DB=molding_shop \
  -v postgres_data:/var/lib/postgresql/data \
  --replace \
  postgres:16-alpine

# Start MinIO
echo "Starting MinIO..."
podman run -d \
  --name molding-minio \
  --network molding-net \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=password123 \
  -v minio_data:/data \
  --replace \
  minio/minio:latest server /data --console-address ":9001"

echo "Waiting for services to be ready..."
sleep 5

# Initialize MinIO
echo "Initializing MinIO bucket..."
bun packages/api/src/scripts/init-minio.ts

echo "Development environment started!"
