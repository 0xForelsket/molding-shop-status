import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Hono } from 'hono';

const upload = new Hono();

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'password123',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET || 'molding-shop-assets';

upload.post('/', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const fileName = `parts/${Date.now()}-${file.name}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: Buffer.from(buffer),
        ContentType: file.type,
        ACL: 'public-read', // Make it public
      })
    );

    // Construct public URL
    // For MinIO local, it's usually http://localhost:9000/bucket/key
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const publicUrl = `${endpoint}/${BUCKET_NAME}/${fileName}`;

    return c.json({ url: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

export default upload;
