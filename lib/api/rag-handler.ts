/**
 * RAG (Retrieval-Augmented Generation) Handler
 * Manages document search and retrieval from n8n webhook
 */

import type { TenantId } from '@/lib/config/tenants';

export interface RAGSearchRequest {
  query: string;
  tenant: TenantId;
  documentTypes?: string[];
  topK?: number;
}

export interface RAGSearchResponse {
  chunks: string[];
  sources: string[];
  confidence: number;
  processingTime: number;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    tenant: TenantId;
    documentType?: string;
    page?: number;
    confidence?: number;
  };
}

class RAGHandler {
  private webhookUrl: string;
  private timeout: number;

  constructor() {
    this.webhookUrl = process.env.N8N_RAG_WEBHOOK_URL || '';
    this.timeout = 15000; // 15 seconds timeout
  }

  /**
   * Search for relevant documents using the n8n RAG webhook
   */
  async searchDocuments(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    if (!this.webhookUrl) {
      console.warn('N8N_RAG_WEBHOOK_URL not configured');
      return {
        chunks: [],
        sources: [],
        confidence: 0,
        processingTime: 0
      };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: request.query,
          tenant: request.tenant,
          documentTypes: request.documentTypes,
          topK: request.topK || 5,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`RAG webhook returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process and format the response
      const processedChunks = this.processChunks(data.chunks || data.results || []);
      const sources = this.extractSources(processedChunks);

      return {
        chunks: processedChunks.map(chunk => chunk.content),
        sources: sources,
        confidence: data.confidence || this.calculateConfidence(processedChunks),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('RAG search timeout after', this.timeout, 'ms');
        } else {
          console.error('RAG search error:', error.message);
        }
      }

      return {
        chunks: [],
        sources: [],
        confidence: 0,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process raw chunks from the n8n response
   */
  private processChunks(rawChunks: any[]): DocumentChunk[] {
    if (!Array.isArray(rawChunks)) {
      return [];
    }

    return rawChunks
      .filter(chunk => chunk && (chunk.content || chunk.text))
      .map((chunk, index) => ({
        id: chunk.id || `chunk-${index}`,
        content: chunk.content || chunk.text || '',
        metadata: {
          source: chunk.source || chunk.filename || 'Unknown',
          tenant: chunk.tenant || 'amanda',
          documentType: chunk.documentType || chunk.type,
          page: chunk.page || chunk.pageNumber,
          confidence: chunk.confidence || chunk.score || 0.5
        }
      }))
      .filter(chunk => chunk.content.trim().length > 0);
  }

  /**
   * Extract unique source documents from chunks
   */
  private extractSources(chunks: DocumentChunk[]): string[] {
    const sources = new Set<string>();
    
    chunks.forEach(chunk => {
      if (chunk.metadata.source && chunk.metadata.source !== 'Unknown') {
        sources.add(chunk.metadata.source);
      }
    });

    return Array.from(sources);
  }

  /**
   * Calculate overall confidence score for the search results
   */
  private calculateConfidence(chunks: DocumentChunk[]): number {
    if (chunks.length === 0) return 0;

    const confidences = chunks
      .map(chunk => chunk.metadata.confidence || 0)
      .filter(conf => conf > 0);

    if (confidences.length === 0) return 0.5;

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Format chunks for display in chat response
   */
  formatChunksForDisplay(chunks: string[], sources: string[]): string {
    if (chunks.length === 0) {
      return '';
    }

    let formatted = '\n\n**📚 Information from Practice Documents:**\n\n';

    chunks.forEach((chunk, index) => {
      formatted += `${index + 1}. ${chunk.trim()}\n\n`;
    });

    if (sources.length > 0) {
      formatted += `*Sources: ${sources.join(', ')}*`;
    }

    return formatted;
  }

  /**
   * Check if RAG search should be triggered based on the query
   */
  shouldTriggerRAG(query: string): boolean {
    // Keywords that suggest a need for document search
    const ragKeywords = [
      'protocol', 'procedure', 'policy', 'guideline',
      'how to', 'what is our', 'what are our',
      'treatment', 'care', 'instruction',
      'form', 'document', 'template'
    ];

    const lowerQuery = query.toLowerCase();
    return ragKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Get tenant-specific document filters
   */
  getTenantDocumentTypes(tenant: TenantId): string[] {
    const documentTypesByTenant = {
      amanda: ['session-notes', 'protocols', 'intake-forms', 'treatment-plans'],
      robbie: ['procedures', 'contraindications', 'pre-care', 'post-care'],
      emmer: ['surgical-protocols', 'consultations', 'medical-conditions', 'post-op-care']
    };

    return documentTypesByTenant[tenant] || [];
  }
}

// Export singleton instance
export const ragHandler = new RAGHandler();

// Export function for direct use in components
export async function performRAGSearch(
  query: string, 
  tenant: TenantId,
  options?: {
    documentTypes?: string[];
    topK?: number;
  }
): Promise<RAGSearchResponse> {
  return ragHandler.searchDocuments({
    query,
    tenant,
    documentTypes: options?.documentTypes,
    topK: options?.topK
  });
}