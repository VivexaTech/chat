import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadMediaFile } from '../../services/media.service';

export interface ImageViewerProps {
  imageUrl: string;
  fileName: string;
  caption?: string | null;
  senderName?: string;
  onClose: () => void;
}

export function ImageViewer({
  imageUrl,
  fileName,
  caption,
  senderName,
  onClose,
}: ImageViewerProps) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadMediaFile(imageUrl, fileName);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen image viewer"
      className="fixed inset-0 z-50 bg-slate-950/92 flex flex-col justify-between p-4"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-4 text-white max-w-6xl w-full mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{senderName || 'Shared image'}</p>
          <p className="text-xs text-slate-300 truncate font-mono-tabular">{fileName}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{downloading ? 'Saving...' : 'Download'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image viewer"
            className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center min-h-0 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={caption || fileName}
          className="max-h-[80vh] max-w-[92vw] rounded-xl object-contain shadow-2xl select-none"
        />
      </div>

      {caption ? (
        <div
          className="max-w-2xl mx-auto text-center text-sm text-slate-100 bg-black/40 px-4 py-2 rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {caption}
        </div>
      ) : (
        <div className="h-2" />
      )}
    </div>
  );
}
