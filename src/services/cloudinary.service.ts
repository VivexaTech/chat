import {
  DEFAULT_CLOUDINARY_FOLDER,
  defaultChatConfig,
  getMissingCloudinaryEnvKeys,
} from '../config/chat.config';
import type {
  CloudinaryConfig,
  CloudinaryResourceType,
  CloudinarySignaturePayload,
  UploadProgress,
} from '../types/chat.types';

export interface CloudinaryUploadParams {
  config?: CloudinaryConfig;
  conversationId: string;
  senderId: string;
  subfolder: 'images' | 'audio';
  resourceType: CloudinaryResourceType;
  data: Blob | File;
  fileName: string;
  onProgress?: (progress: UploadProgress) => void;
  onAbortCreated?: (abort: () => void) => void;
}

export interface CloudinaryUploadResponse {
  secureUrl: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
}

async function resolveSignatureFromEndpoint(
  endpoint: string,
  payload: {
    folder: string;
    resourceType: CloudinaryResourceType;
    conversationId: string;
    senderId: string;
    fileName: string;
  },
): Promise<CloudinarySignaturePayload> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudinary upload signature (${response.status}).`);
  }

  const data = (await response.json()) as Partial<CloudinarySignaturePayload>;
  if (!data.signature || !data.timestamp || !data.apiKey) {
    throw new Error('Invalid Cloudinary signature payload returned by server.');
  }

  return {
    signature: data.signature,
    timestamp: data.timestamp,
    apiKey: data.apiKey,
    cloudName: data.cloudName,
    uploadPreset: data.uploadPreset,
    folder: data.folder,
    publicId: data.publicId,
  };
}

/**
 * Uploads an image or audio/video file to Cloudinary.
 * Defaults to unsigned upload preset for local testing and switches seamlessly to
 * server-signed uploads when `getSignature` or `signedUploadEndpoint` is configured.
 */
export async function uploadToCloudinary(
  params: CloudinaryUploadParams,
): Promise<CloudinaryUploadResponse> {
  const cfg = params.config ?? defaultChatConfig.cloudinary;
  const missing = getMissingCloudinaryEnvKeys(cfg);
  if (missing.length > 0) {
    throw new Error(
      `Cloudinary is not configured. Set ${missing.join(', ')} in your .env file before uploading media.`,
    );
  }

  const folderPrefix = (cfg.folderPrefix ?? DEFAULT_CLOUDINARY_FOLDER).replace(/\/+$/, '');
  const targetFolder = folderPrefix
    ? `${folderPrefix}/${params.conversationId}/${params.subfolder}`
    : `${params.conversationId}/${params.subfolder}`;

  const formData = new FormData();
  formData.append('file', params.data, params.fileName);

  let activeCloudName = cfg.cloudName.trim();

  if (cfg.getSignature || cfg.signedUploadEndpoint) {
    const sigPayload = cfg.getSignature
      ? await cfg.getSignature({
          folder: targetFolder,
          resourceType: params.resourceType,
          conversationId: params.conversationId,
          senderId: params.senderId,
          fileName: params.fileName,
        })
      : await resolveSignatureFromEndpoint(cfg.signedUploadEndpoint!, {
          folder: targetFolder,
          resourceType: params.resourceType,
          conversationId: params.conversationId,
          senderId: params.senderId,
          fileName: params.fileName,
        });

    if (sigPayload.cloudName) {
      activeCloudName = sigPayload.cloudName.trim();
    }
    formData.append('api_key', sigPayload.apiKey);
    formData.append('timestamp', String(sigPayload.timestamp));
    formData.append('signature', sigPayload.signature);
    if (sigPayload.uploadPreset) {
      formData.append('upload_preset', sigPayload.uploadPreset);
    }
    formData.append('folder', sigPayload.folder ?? targetFolder);
    if (sigPayload.publicId) {
      formData.append('public_id', sigPayload.publicId);
    }
  } else {
    formData.append('upload_preset', cfg.uploadPreset!.trim());
    formData.append('folder', targetFolder);
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(activeCloudName)}/${params.resourceType}/upload`;

  return new Promise<CloudinaryUploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    params.onAbortCreated?.(() => xhr.abort());

    xhr.open('POST', uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const total = event.total || params.data.size || 1;
      const progress = Math.min(99, Math.round((event.loaded / total) * 100));
      params.onProgress?.({
        progress,
        bytesTransferred: event.loaded,
        totalBytes: total,
        state: 'running',
      });
    };

    xhr.onerror = () => {
      params.onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: params.data.size,
        state: 'error',
      });
      reject(new Error('Network error while uploading media to Cloudinary.'));
    };

    xhr.onabort = () => {
      params.onProgress?.({
        progress: 0,
        bytesTransferred: 0,
        totalBytes: params.data.size,
        state: 'canceled',
      });
      const err = new Error('Upload canceled.') as Error & { code?: string };
      err.code = 'cloudinary/canceled';
      reject(err);
    };

    xhr.onload = () => {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        parsed = null;
      }

      if (xhr.status < 200 || xhr.status >= 300 || !parsed) {
        const apiError =
          parsed &&
          typeof parsed.error === 'object' &&
          parsed.error !== null &&
          typeof (parsed.error as Record<string, unknown>).message === 'string'
            ? String((parsed.error as Record<string, unknown>).message)
            : `Cloudinary upload failed with HTTP ${xhr.status}.`;
        params.onProgress?.({
          progress: 0,
          bytesTransferred: 0,
          totalBytes: params.data.size,
          state: 'error',
        });
        reject(new Error(apiError));
        return;
      }

      const secureUrl = typeof parsed.secure_url === 'string' ? parsed.secure_url : '';
      const publicId = typeof parsed.public_id === 'string' ? parsed.public_id : '';
      if (!secureUrl) {
        reject(new Error('Cloudinary did not return a secure media URL.'));
        return;
      }

      const bytes = typeof parsed.bytes === 'number' ? parsed.bytes : params.data.size;
      params.onProgress?.({
        progress: 100,
        bytesTransferred: bytes,
        totalBytes: bytes,
        state: 'success',
      });

      resolve({
        secureUrl,
        publicId,
        resourceType:
          parsed.resource_type === 'image' ||
          parsed.resource_type === 'video' ||
          parsed.resource_type === 'raw'
            ? parsed.resource_type
            : params.resourceType,
        bytes,
        ...(typeof parsed.width === 'number' ? { width: parsed.width } : {}),
        ...(typeof parsed.height === 'number' ? { height: parsed.height } : {}),
        ...(typeof parsed.duration === 'number' ? { duration: parsed.duration } : {}),
        ...(typeof parsed.format === 'string' ? { format: parsed.format } : {}),
      });
    };

    xhr.send(formData);
  });
}
