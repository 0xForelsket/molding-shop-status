import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'password123',
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET || 'molding-shop-assets';

async function initMinio() {
  console.log(`Checking bucket: ${BUCKET_NAME}...`);

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Bucket ${BUCKET_NAME} already exists.`);
  } catch (error: unknown) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      console.log(`Bucket ${BUCKET_NAME} not found. Creating...`);
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`Bucket ${BUCKET_NAME} created.`);
    } else {
      console.error('Error checking bucket:', error);
      process.exit(1);
    }
  }

  // Set public read policy
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicReadGetObject',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
      },
    ],
  };

  console.log('Setting public read policy...');
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(policy),
    })
  );
  console.log('Policy set.');
}

initMinio().catch(console.error);
