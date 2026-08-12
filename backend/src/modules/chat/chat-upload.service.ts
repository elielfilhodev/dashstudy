import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { put } from '@vercel/blob';
import { ENV, type Env } from '../../common/config/env';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024;
export const UPLOAD_MAX_BYTES = MAX_DOC_BYTES;

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

type AttachmentType = 'image' | 'gif' | 'document';

function detectType(mime: string): AttachmentType | null {
  if (IMAGE_MIMES.has(mime)) return mime === 'image/gif' ? 'gif' : 'image';
  if (DOC_MIMES.has(mime)) return 'document';
  return null;
}

@Injectable()
export class ChatUploadService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async upload(userId: string, file: Express.Multer.File) {
    if (!this.env.BLOB_READ_WRITE_TOKEN) {
      throw new ServiceUnavailableException(
        'Armazenamento de arquivos não configurado (BLOB_READ_WRITE_TOKEN ausente)',
      );
    }
    if (!file?.originalname)
      throw new BadRequestException('Arquivo não enviado');

    const type = detectType(file.mimetype);
    if (!type) throw new BadRequestException('Tipo de arquivo não suportado');

    const maxBytes = type === 'document' ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Arquivo muito grande (máx ${Math.round(maxBytes / 1024 / 1024)} MB)`,
      );
    }

    const blob = await put(
      `chat/${userId}/${Date.now()}-${file.originalname}`,
      file.buffer,
      {
        access: 'public',
        contentType: file.mimetype,
        token: this.env.BLOB_READ_WRITE_TOKEN,
      },
    );

    return { url: blob.url, type, name: file.originalname };
  }
}
