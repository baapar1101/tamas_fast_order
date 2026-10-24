import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { badRequest } from '../lib/errors.js';
import { processUpload } from './uploads.js';
export interface NativeAttachmentInput {
  ownerId:number; buffer:Buffer; filename:string; mimeType:string;
  scope:'credit'|'payment'; documentRequestId?:number;
}
export async function uploadNativeAttachment(input:NativeAttachmentInput) {
  let scope=input.scope;
  if(input.documentRequestId){
    const [request]=await db.select({scope:schema.uploads.privateScope}).from(schema.documentReuploadRequests)
      .innerJoin(schema.uploads,eq(schema.uploads.id,schema.documentReuploadRequests.originalUploadId))
      .where(and(eq(schema.documentReuploadRequests.id,input.documentRequestId),eq(schema.documentReuploadRequests.userId,input.ownerId),eq(schema.documentReuploadRequests.status,'pending'))).limit(1);
    if(!request?.scope)throw badRequest('درخواست فعال بارگذاری مدرک متعلق به شما پیدا نشد.');
    scope=request.scope;
  }
  return processUpload({buffer:input.buffer,filename:input.filename,mimeType:input.mimeType,
    uploadedBy:input.ownerId,kind:scope==='credit'?'certificate':'other',privateScope:scope});
}
