import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Plus,
  Star,
  Trash2,
  Eye,
  User,
  Scan,
} from 'lucide-react';
import { Button, Select } from '../../../components/ui';
import {
  RadiologyRequestDTO,
  VIEW_PLANES,
  ViewPlane,
  UploadScanImageDTO,
  getModalityColor,
  ImagingModality,
} from '../dtos/radiology.dto';
import {
  formatPatientName,
  formatDetailedAge,
} from '../../patient-registration/dtos/patient.dto';
import {
  uploadFile,
  generateRadiologyImagePath,
  mapWithConcurrency,
  optimizeRadiologyUploadFile,
} from '../../../utils/storage';

// Image file with metadata
interface ImageFile {
  id: string;
  file: File;
  previewUrl: string | null;
  viewPlane: ViewPlane;
  isKeyImage: boolean;
  sequenceNumber: number;
}

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (images: UploadScanImageDTO[]) => void;
  request: RadiologyRequestDTO | null;
  isLoading?: boolean;
}

const isPreviewableImage = (file: File): boolean =>
  file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.dcm');

const revokePreviewUrl = (previewUrl: string | null): void => {
  if (!previewUrl || !previewUrl.startsWith('blob:')) return;
  URL.revokeObjectURL(previewUrl);
};

const IMAGE_UPLOAD_CONCURRENCY = 3;

export default function ImageUploadModal({
  isOpen,
  onClose,
  onSubmit,
  request,
  isLoading,
}: ImageUploadModalProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const imagesRef = useRef<ImageFile[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      imagesRef.current.forEach((img) => revokePreviewUrl(img.previewUrl));
    },
    [],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const generateId = () =>
    `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const validateFile = (file: File): boolean => {
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/dicom',
      'application/dicom',
    ];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validTypes.includes(file.type) && !file.name.endsWith('.dcm')) {
      setUploadError(
        'Invalid file type. Please upload JPEG, PNG, or DICOM files.',
      );
      return false;
    }

    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 50MB.');
      return false;
    }

    setUploadError(null);
    return true;
  };

  const addImageFile = (file: File) => {
    if (!validateFile(file)) return;

    const id = generateId();
    const previewUrl = isPreviewableImage(file)
      ? URL.createObjectURL(file)
      : null;

    setImages((prev) => [
      ...prev,
      {
        id,
        file,
        previewUrl,
        viewPlane: 'AP',
        isKeyImage: prev.length === 0,
        sequenceNumber: prev.length + 1,
      },
    ]);

    setSelectedImageId((prev) => prev || id);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files) {
        Array.from(e.dataTransfer.files).forEach((file) => addImageFile(file));
      }
    },
    [images.length],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file) => addImageFile(file));
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      revokePreviewUrl(removed?.previewUrl ?? null);

      const filtered = prev.filter((img) => img.id !== id);
      // Renumber sequence
      return filtered.map((img, idx) => ({ ...img, sequenceNumber: idx + 1 }));
    });
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const updateImage = (id: string, updates: Partial<ImageFile>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img)),
    );
  };

  const setAsKeyImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        isKeyImage: img.id === id,
      })),
    );
  };

  const handleSubmit = async () => {
    if (images.length === 0 || !request) return;

    try {
      const uploadedImages = await mapWithConcurrency(
        images,
        IMAGE_UPLOAD_CONCURRENCY,
        async (img) => {
          const uploadFilePayload = await optimizeRadiologyUploadFile(img.file);
          const path = generateRadiologyImagePath(
            request.request_id,
            uploadFilePayload.name,
          );
          const publicUrl = await uploadFile(
            'radiology-images',
            path,
            uploadFilePayload,
          );

          return {
            scan_request_id: request.request_id,
            image_path: publicUrl,
            file_name: uploadFilePayload.name,
            file_size: uploadFilePayload.size,
            mime_type: uploadFilePayload.type,
            view_plane: img.viewPlane,
            sequence_number: img.sequenceNumber,
            is_key_image: img.isKeyImage,
          } as UploadScanImageDTO;
        },
      );

      onSubmit(uploadedImages);
    } catch (error) {
      console.error('Error uploading images:', error);
      setUploadError('Failed to upload images to storage.');
    }
  };

  const clearAll = () => {
    images.forEach((img) => revokePreviewUrl(img.previewUrl));
    setImages([]);
    setSelectedImageId(null);
    setUploadError(null);
  };
  const handleClose = () => {
    clearAll();
    onClose();
  };

  if (!isOpen || !request) return null;

  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* EMR Header with NDC Branding */}
          <div className="bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600">
              <div className="flex items-center gap-4">
                <div className="border-l border-white/30 pl-4">
                  <h1 className="text-white font-bold text-lg tracking-wide">
                    XENOCARE
                  </h1>
                  <p className="text-green-100 text-xs font-medium">
                    Medical Centre - Image Upload
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-4">
                  <p className="text-white text-sm font-medium">
                    REQ #{request.request_id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-green-100 text-xs">
                    {images.length} image{images.length !== 1 ? 's' : ''}{' '}
                    selected
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="p-6 space-y-5">
              {/* Patient & Imaging Info */}
              <div className="grid grid-cols-2 gap-5">
                {/* Patient Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Patient</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow">
                      {request.patient?.first_name?.charAt(0)}
                      {request.patient?.surname?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {request.patient
                          ? formatPatientName(request.patient)
                          : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.patient?.gender} •{' '}
                        {request.patient?.date_of_birth
                          ? formatDetailedAge(request.patient.date_of_birth)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Imaging Info Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Scan className="h-4 w-4 text-purple-600" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Imaging Study
                    </h3>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getModalityColor(
                          request.imaging_type as ImagingModality,
                        )}`}
                      >
                        {request.imaging_type}
                      </span>
                      {request.imaging?.category && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {request.imaging.category}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {request.imaging?.imaging_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.imaging?.body_part ||
                        request.body_part ||
                        'Body part not specified'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100 rounded-xl">
                      <Upload className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Upload Images
                      </h3>
                      <p className="text-xs text-gray-500">
                        Drag and drop or click to upload imaging files
                      </p>
                    </div>
                  </div>
                  {images.length > 0 && (
                    <button
                      onClick={clearAll}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-primary-700 bg-green-50'
                      : uploadError
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,.dcm,application/dicom"
                    multiple
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="space-y-2">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                      <Plus className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">
                      Drag and drop image files here, or click to browse
                    </p>
                    <p className="text-sm text-gray-400">
                      Supports JPEG, PNG, and DICOM files up to 50MB each
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {uploadError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mt-4">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Uploaded Images List */}
              {images.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="p-2.5 bg-emerald-100 rounded-xl">
                      <ImageIcon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">
                        Uploaded Images
                      </h3>
                      <p className="text-xs text-gray-500">
                        {images.length} image{images.length !== 1 ? 's' : ''}{' '}
                        ready for upload
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className={`relative bg-gray-50 rounded-xl border-2 p-3 transition-all cursor-pointer ${
                          selectedImageId === img.id
                            ? 'border-primary-700 ring-2 ring-primary-700/20'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedImageId(img.id)}
                      >
                        {/* Key Image Badge */}
                        {img.isKeyImage && (
                          <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            Key
                          </div>
                        )}

                        {/* Sequence Number */}
                        <div className="absolute top-2 right-2 z-10 bg-gray-900/70 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                          #{img.sequenceNumber}
                        </div>

                        {/* Preview */}
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-900 mb-3">
                          {img.previewUrl ? (
                            <img
                              src={img.previewUrl}
                              alt={img.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-gray-600" />
                            </div>
                          )}
                        </div>

                        {/* File Info */}
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {img.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(img.file.size / (1024 * 1024)).toFixed(2)} MB •{' '}
                          {img.viewPlane}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={img.viewPlane}
                            onChange={(e) =>
                              updateImage(img.id, {
                                viewPlane: e.target.value as ViewPlane,
                              })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-primary-700 focus:border-primary-700"
                          >
                            {VIEW_PLANES.map((plane) => (
                              <option key={plane} value={plane}>
                                {plane}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAsKeyImage(img.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              img.isKeyImage
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                            }`}
                            title="Set as key image"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(img.id);
                            }}
                            className="p-1.5 bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                            title="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Image Preview */}
                  {selectedImage && selectedImage.previewUrl && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Preview: {selectedImage.file.name}
                      </p>
                      <div className="bg-gray-900 rounded-xl overflow-hidden">
                        <img
                          src={selectedImage.previewUrl}
                          alt="Selected preview"
                          className="max-h-80 w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Summary Card */}
              {images.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {images.length} image{images.length !== 1 ? 's' : ''}{' '}
                          ready for upload
                        </p>
                        <p className="text-xs text-emerald-600">
                          Key image:{' '}
                          {images.find((img) => img.isKeyImage)?.file.name ||
                            'None selected'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">
                        Total size:{' '}
                        {(
                          images.reduce((sum, img) => sum + img.file.size, 0) /
                          (1024 * 1024)
                        ).toFixed(2)}{' '}
                        MB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with Actions */}
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Images will be associated with request #
                {request.request_id.slice(0, 8).toUpperCase()}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <button
                  onClick={handleSubmit}
                  disabled={images.length === 0 || isLoading}
                  className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-800 hover:to-[#007538] text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload{' '}
                      {images.length > 0
                        ? `${images.length} Image${images.length !== 1 ? 's' : ''}`
                        : 'Images'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
