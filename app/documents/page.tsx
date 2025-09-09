'use client';

import { DocumentUpload } from '@/components/document-upload';
import { AuthChatWrapper } from '@/components/auth-chat-wrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface Document {
  id: string;
  filename: string;
  uploadedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  googleDriveUrl?: string;
}

export default function DocumentsPage() {
  const { user } = useUser();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's documents
  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      // TODO: Implement this endpoint
      // const response = await fetch('/api/documents');
      // const data = await response.json();
      // setDocuments(data.documents);
      
      // For now, show demo data
      setDocuments([
        {
          id: '1',
          filename: 'Patient Protocol Guidelines.pdf',
          uploadedAt: new Date().toISOString(),
          status: 'completed'
        },
        {
          id: '2',
          filename: 'Treatment Plans 2024.docx',
          uploadedAt: new Date().toISOString(),
          status: 'processing'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // TODO: Implement delete endpoint
      // await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const getStatusColor = (status: Document['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <AuthChatWrapper>
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/chat">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Chat
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Document Management</h1>
            </div>
          </div>

          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <DocumentUpload 
              onStartChatWithDocument={(fileName) => {
                // Navigate to chat with a message about the uploaded document
                window.location.href = `/chat?message=${encodeURIComponent(`I just uploaded ${fileName}. Can you help me understand its contents?`)}`;
              }}
            />
            
            {/* Instructions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">How RAG Works</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex gap-2">
                  <span className="font-semibold">1.</span>
                  <span>Upload your medical documents, protocols, or guidelines</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">2.</span>
                  <span>Documents are processed and indexed by AI</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">3.</span>
                  <span>When you chat, the AI searches your documents for relevant information</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold">4.</span>
                  <span>Responses include citations from your specific documents</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Privacy:</strong> Each user has their own isolated document folder. Your documents are never shared with other users.
                </p>
              </div>
            </Card>
          </div>

          {/* Documents List */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Your Documents</h3>
            
            {loading ? (
              <p className="text-gray-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-gray-500">No documents uploaded yet. Upload your first document above!</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-sm text-gray-500">
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </span>
                      
                      <div className="flex gap-2">
                        {doc.googleDriveUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.googleDriveUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDocument(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AuthChatWrapper>
  );
}