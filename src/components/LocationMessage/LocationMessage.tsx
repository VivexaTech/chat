import { ExternalLink, MapPin, Navigation, X } from 'lucide-react';
import { buildGoogleMapsUrl } from '../../services/location.service';
import type { LocationData } from '../../types/chat.types';
import { formatCoordinate } from '../../utils/formatters';

export interface LocationMessageProps {
  location: LocationData;
  isOutgoing: boolean;
}

export function LocationMessage({ location, isOutgoing }: LocationMessageProps) {
  const mapsUrl = buildGoogleMapsUrl(location.latitude, location.longitude);

  return (
    <div
      className={`w-60 sm:w-68 rounded-xl overflow-hidden border ${
        isOutgoing
          ? 'bg-white/10 border-white/20 text-white'
          : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}
    >
      <div
        className={`relative h-20 flex items-center justify-center ${
          isOutgoing ? 'bg-[#0B5D56]' : 'bg-teal-50/80'
        }`}
        style={{
          backgroundImage: isOutgoing
            ? 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)'
            : 'radial-gradient(rgba(15,118,110,0.18) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shadow-sm ${
            isOutgoing ? 'bg-white text-[#0F766E]' : 'bg-[#0F766E] text-white'
          }`}
        >
          <MapPin className="h-5 w-5" />
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div>
          <p className="text-xs font-medium">Shared location</p>
          <p
            className={`text-[11px] font-mono-tabular mt-0.5 ${
              isOutgoing ? 'text-teal-100' : 'text-slate-600'
            }`}
          >
            {formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}
          </p>
          {typeof location.accuracy === 'number' && (
            <p className={`text-[11px] mt-0.5 ${isOutgoing ? 'text-teal-100/80' : 'text-slate-500'}`}>
              Accuracy: ±{location.accuracy} m
            </p>
          )}
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full h-8 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
            isOutgoing
              ? 'bg-white text-[#0F766E] hover:bg-teal-50'
              : 'bg-[#0F766E] text-white hover:bg-[#115E59]'
          }`}
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export interface LocationConfirmModalProps {
  location: LocationData;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LocationConfirmModal({
  location,
  sending,
  onConfirm,
  onCancel,
}: LocationConfirmModalProps) {
  const mapsUrl = buildGoogleMapsUrl(location.latitude, location.longitude);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm location sharing"
      className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center shrink-0">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Share current location</h2>
              <p className="text-xs text-slate-500">Confirm coordinates before sending</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close location confirmation"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Latitude</span>
            <span className="font-mono-tabular font-medium text-slate-800">
              {formatCoordinate(location.latitude)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Longitude</span>
            <span className="font-mono-tabular font-medium text-slate-800">
              {formatCoordinate(location.longitude)}
            </span>
          </div>
          {typeof location.accuracy === 'number' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Accuracy</span>
              <span className="font-mono-tabular text-slate-700">±{location.accuracy} m</span>
            </div>
          )}
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F766E] hover:underline"
        >
          <span>Preview on Google Maps</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="h-9 px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-60 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            {sending ? 'Sending...' : 'Share location'}
          </button>
        </div>
      </div>
    </div>
  );
}
