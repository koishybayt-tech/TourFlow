import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

/** S3-compatible file storage (SeaweedFS locally, S3 in Kazakhstan in production). */

let client: S3Client | null = null
let bucketReady: Promise<void> | null = null

export function s3Bucket(): string {
  return process.env.S3_BUCKET || 'tourflow'
}

export function s3(): S3Client {
  if (client) return client
  client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || '',
      secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
  })
  return client
}

export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    try {
      await s3().send(new HeadBucketCommand({ Bucket: s3Bucket() }))
    }
    catch {
      await s3().send(new CreateBucketCommand({ Bucket: s3Bucket() }))
    }
  })().catch((e) => {
    bucketReady = null
    throw e
  })
  return bucketReady
}

export async function putFile(key: string, body: Buffer | Uint8Array | string, contentType = 'application/octet-stream'): Promise<void> {
  await ensureBucket()
  await s3().send(new PutObjectCommand({ Bucket: s3Bucket(), Key: key, Body: body, ContentType: contentType }))
}

export async function getFile(key: string): Promise<{ body: Uint8Array, contentType: string }> {
  await ensureBucket()
  const res = await s3().send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }))
  const body = await res.Body!.transformToByteArray()
  return { body, contentType: res.ContentType || 'application/octet-stream' }
}

/** Minimal one-page PDF with a text line — used for demo files and placeholders. */
export function simplePdf(title: string): Buffer {
  const text = title.replace(/[^\x20-\x7E]/g, '?').replace(/([()\\])/g, '\\$1')
  const content = `BT /F1 14 Tf 72 760 Td (${text}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}
