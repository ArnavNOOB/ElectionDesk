import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Eye, ShieldCheck, AlertCircle } from 'lucide-react';
import { voterApi } from '../api/client';

export function PhotoUploader({ voterId, photoKey, onPhotoUpdated, canEdit = true }) {
  const [previewUrl, setPreviewUrl] = useState(photoKey ? voterApi.getPhotoUrl(voterId) : null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showFullPreview, setShowFullPreview] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo exceeds 5MB maximum limit');
      return;
    }

    // Validate type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setError('Only legitimate JPEG, PNG, or WebP files are accepted');
      return;
    }

    setError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', file);

      await voterApi.uploadPhoto(voterId, formData);
      const newUrl = `${voterApi.getPhotoUrl(voterId)}?t=${Date.now()}`;
      setPreviewUrl(newUrl);
      if (onPhotoUpdated) onPhotoUpdated(newUrl);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Photo upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Are you sure you want to delete this photo under the retention policy?')) return;

    try {
      setIsUploading(true);
      await voterApi.deletePhoto(voterId);
      setPreviewUrl(null);
      if (onPhotoUpdated) onPhotoUpdated(null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to remove photo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center sm:items-start space-y-3">
      <div className="relative group">
        <div className="h-32 w-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner relative">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Voter Portrait"
              className="h-full w-full object-cover"
              onError={() => setPreviewUrl(null)}
            />
          ) : (
            <div className="flex flex-col items-center text-slate-400 p-2 text-center">
              <Camera className="h-8 w-8 mb-1" />
              <span className="text-xs">No Photo Available</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-xs font-medium">
              Sanitizing EXIF...
            </div>
          )}
        </div>

        {/* Action overlay buttons */}
        {previewUrl && (
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              type="button"
              onClick={() => setShowFullPreview(true)}
              title="View full-size photo"
              className="p-1 rounded-md bg-white/90 text-slate-700 shadow hover:bg-white"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleDeletePhoto}
                title="Remove photo"
                className="p-1 rounded-md bg-rose-50 text-rose-600 shadow hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-col space-y-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            {previewUrl ? 'Replace Photo' : 'Upload Voter Photo'}
          </button>
          <span className="text-[11px] text-slate-500 flex items-center">
            <ShieldCheck className="h-3 w-3 text-emerald-600 mr-1 flex-shrink-0" />
            EXIF & GPS metadata automatically stripped.
          </span>
        </div>
      )}

      {error && (
        <div className="text-xs text-rose-600 flex items-center">
          <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Full-size preview modal */}
      {showFullPreview && previewUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-4">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">Protected Official Voter Photo</span>
              <button
                onClick={() => setShowFullPreview(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-auto rounded-lg bg-slate-100 p-2">
              <img src={previewUrl} alt="Full portrait" className="max-h-[60vh] object-contain rounded" />
            </div>
            <div className="mt-3 text-xs text-slate-500 text-center">
              Watermarked and encrypted in transit. Served over authenticated endpoint only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoUploader;
