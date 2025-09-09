'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@clerk/nextjs';

interface UploadStatus {
  stage: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message: string;
  progress: number;
}

interface DocumentUploadProps {
  onStartChatWithDocument?: (fileName: string) => void;
}

export function DocumentUpload({ onStartChatWithDocument }: DocumentUploadProps) {
  const { user } = useUser();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    stage: 'idle',
    message: '',
    progress: 0
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
    const fileName = file.name.toLowerCase();
    const isValid = validTypes.some(type => fileName.endsWith(type));
    
    if (!isValid) {
      setUploadStatus({
        stage: 'error',
        message: 'Invalid file type. Please upload PDF, DOC, DOCX, TXT, or MD files.',
        progress: 0
      });
      return;
    }
    
    setSelectedFile(file);
    setUploadStatus({ stage: 'idle', message: '', progress: 0 });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const uploadDocument = async () => {
    if (!selectedFile || !user) return;

    try {
      // Stage 1: Upload to server
      setUploadStatus({
        stage: 'uploading',
        message: 'Uploading document...',
        progress: 30
      });

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('userId', user.id);

      // Send to FastAPI-powered endpoint
      const uploadResponse = await fetch('/api/documents/upload-fastapi', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      // Direct upload always completes immediately
      setUploadStatus({
        stage: 'completed',
        message: uploadResult.message || 'Document uploaded successfully!',
        progress: 100
      });

      // Store the uploaded filename for the chat button
      setUploadedFileName(selectedFile.name);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        stage: 'error',
        message: 'Upload failed. Please try again.',
        progress: 0
      });
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus.stage) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Upload className="h-5 w-5" />;
    }
  };

  const isUploading = uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing';

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Upload Document</h3>
          {getStatusIcon()}
        </div>

        <div className="space-y-4">
          {/* File Input with Drag & Drop */}
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <FileText className={`h-10 w-10 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {selectedFile 
                  ? selectedFile.name 
                  : isDragging 
                    ? 'Drop your document here' 
                    : 'Drag & drop or click to select a document'}
              </span>
              <span className="text-xs text-gray-500">
                Supported: PDF, DOC, DOCX, TXT, MD
              </span>
            </label>
          </div>

          {/* Upload Button */}
          {selectedFile && !isUploading && uploadStatus.stage !== 'completed' && (
            <Button onClick={uploadDocument} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Upload & Process
            </Button>
          )}

          {/* Progress Bar */}
          {uploadStatus.progress > 0 && (
            <div className="space-y-2">
              <Progress value={uploadStatus.progress} />
              <p className="text-sm text-gray-600 text-center">
                {uploadStatus.message}
              </p>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus.stage === 'completed' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">{uploadStatus.message}</p>
                <p className="text-xs text-green-600 mt-2">
                  Your document is now searchable in chat!
                </p>
              </div>
              {uploadedFileName && onStartChatWithDocument && (
                <Button
                  onClick={() => onStartChatWithDocument(uploadedFileName)}
                  className="w-full"
                  variant="outline"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat with Document
                </Button>
              )}
            </div>
          )}

          {/* Error Message */}
          {uploadStatus.stage === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{uploadStatus.message}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}