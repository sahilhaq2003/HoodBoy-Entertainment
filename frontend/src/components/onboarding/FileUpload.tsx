import React, { useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept?: string;
  onChange: (file: File) => void;
  currentFile?: string;
  onRemove?: () => void;
  error?: string;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx',
  onChange,
  currentFile,
  onRemove,
  error,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {currentFile ? (
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="text-emerald-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm text-gray-900 truncate font-medium">{currentFile}</div>
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle size={10} />
                Uploaded
              </div>
            </div>
          </div>
          {onRemove && !disabled && (
            <button
              type="button"
              onClick={onRemove}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed transition-all ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50'
          } ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
        >
          <Upload size={20} className="text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
