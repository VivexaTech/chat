import { Image as ImageIcon, MapPin } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface AttachmentMenuProps {
  open: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onShareLocation: () => void;
  locating?: boolean;
}

export function AttachmentMenu({
  open,
  onClose,
  onPickImage,
  onShareLocation,
  locating = false,
}: AttachmentMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Attachment options"
      className="absolute bottom-14 left-0 z-30 w-56 rounded-2xl border border-[#2B1B12]/10 bg-white shadow-lg p-1.5 space-y-0.5"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onPickImage();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-[#3F312A] hover:bg-[#F6F4F1] transition-colors cursor-pointer"
      >
        <span className="h-8 w-8 rounded-lg bg-[#FDF2EC] text-[#C86B3C] flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#1F1612]">Photo</p>
          <p className="text-[11px] text-[#6E5C52]">JPEG, PNG, WebP, or GIF</p>
        </div>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={locating}
        onClick={() => {
          onClose();
          onShareLocation();
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-[#3F312A] hover:bg-[#F6F4F1] disabled:opacity-60 transition-colors cursor-pointer"
      >
        <span className="h-8 w-8 rounded-lg bg-[#7C1620]/10 text-[#7C1620] flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#1F1612]">
            {locating ? 'Locating...' : 'Current location'}
          </p>
          <p className="text-[11px] text-[#6E5C52]">Confirm GPS coordinates</p>
        </div>
      </button>
    </div>
  );
}
