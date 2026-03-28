import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getUploadUrl, getDownloadUrl } from '../../config/s3';

export async function getPresignedUrl(req: AuthRequest, res: Response) {
  const { filename, contentType } = req.body;

  if (!filename || !contentType) {
    throw new AppError(400, 'filename and contentType are required');
  }

  if (!contentType.startsWith('image/')) {
    throw new AppError(400, 'Only image files are allowed');
  }

  const { url: uploadUrl, key } = await getUploadUrl('recipes', filename, contentType);

  res.json({ uploadUrl, key });
}

export async function getFileUrl(req: AuthRequest, res: Response) {
  const { key } = req.query;

  if (!key || typeof key !== 'string') {
    throw new AppError(400, 'key query parameter is required');
  }

  const url = await getDownloadUrl(key);

  res.json({ url });
}
