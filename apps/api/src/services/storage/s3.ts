import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

export interface S3BucketConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function notFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
}

/** The few operations the site needs, on one S3-compatible bucket. */
export class S3Bucket {
  private readonly client: S3Client;
  readonly name: string;

  constructor(config: S3BucketConfig) {
    this.name = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // S3-compatible stores (Ceph and friends) reject the newer default
      // CRC checksum headers; only send them where the protocol requires.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.name, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<{ stream: Readable; size: number; contentType: string; etag?: string; lastModified?: Date } | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.name, Key: key }));
      if (!result.Body) return null;
      return {
        stream: result.Body as Readable,
        size: Number(result.ContentLength ?? 0),
        contentType: result.ContentType ?? 'application/octet-stream',
        etag: result.ETag,
        lastModified: result.LastModified,
      };
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.name, Key: key }));
      return true;
    } catch (error) {
      if (notFound(error)) return false;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.name, Key: key }));
  }

  /** Every key under a prefix (paged through the whole listing). */
  async listKeys(prefix = ''): Promise<Set<string>> {
    const keys = new Set<string>();
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.name, Prefix: prefix || undefined, ContinuationToken: token }));
      for (const item of page.Contents ?? []) if (item.Key) keys.add(item.Key);
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }
}
