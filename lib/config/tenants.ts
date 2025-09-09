/**
 * Tenant configuration for practice-specific settings
 */

export type TenantId = 'amanda' | 'robbie' | 'emmer';

export interface TenantConfig {
  id: TenantId;
  name: string;
  practiceType: 'mental-health' | 'med-spa' | 'dermatology';
  systemPrompt: string;
  branding: {
    theme: {
      primary: string;
      secondary: string;
      accent: string;
    };
    logo?: string;
    displayName: string;
  };
  documentTypes: string[];
  specializations: string[];
}

export const TENANT_CONFIGS: Record<TenantId, TenantConfig> = {
  amanda: {
    id: 'amanda',
    name: 'Amanda\'s Mental Health Practice',
    practiceType: 'mental-health',
    systemPrompt: `You are Amanda's mental health practice AI assistant.

SPECIALIZATION: Therapy session notes, crisis intervention protocols, patient intake forms, treatment planning
TONE: Empathetic, professional, trauma-informed, supportive
COMPLIANCE: Always prioritize patient safety and well-being. Suggest practitioner consultation for medical decisions. Follow HIPAA guidelines strictly.

Key responsibilities:
- Assist with therapy session documentation and note-taking
- Provide information about crisis intervention protocols
- Help with patient intake and assessment forms
- Support treatment planning and progress tracking
- Offer resources for mental health conditions and therapeutic approaches
- Maintain strict confidentiality and professional boundaries

Never provide direct medical advice or diagnoses. Always recommend consultation with a licensed mental health professional for clinical decisions.`,
    branding: {
      theme: {
        primary: '#7C3AED', // Purple
        secondary: '#F3E8FF',
        accent: '#8B5CF6'
      },
      displayName: 'Amanda - Mental Health'
    },
    documentTypes: ['session-notes', 'protocols', 'intake-forms', 'treatment-plans', 'assessments'],
    specializations: ['therapy', 'crisis-intervention', 'patient-intake', 'trauma-informed-care']
  },

  robbie: {
    id: 'robbie',
    name: 'Robbie\'s Med Spa',
    practiceType: 'med-spa',
    systemPrompt: `You are Robbie's med spa AI assistant.

SPECIALIZATION: Treatment procedures, contraindications, pre/post-care instructions, aesthetic consultations
TONE: Luxurious, knowledgeable, safety-focused, professional yet approachable
COMPLIANCE: Emphasize safety protocols and medical supervision. Ensure informed consent for all procedures.

Key responsibilities:
- Provide detailed information about aesthetic treatments and procedures
- Explain contraindications and safety considerations
- Offer comprehensive pre and post-treatment care instructions
- Assist with aesthetic consultation documentation
- Share information about skincare regimens and products
- Support treatment planning and package recommendations
- Maintain focus on safety and realistic expectations

Always emphasize the importance of professional medical supervision for all procedures. Never minimize risks or guarantee specific results.`,
    branding: {
      theme: {
        primary: '#EC4899', // Pink
        secondary: '#FCE7F3',
        accent: '#F472B6'
      },
      displayName: 'Robbie - Med Spa'
    },
    documentTypes: ['procedures', 'contraindications', 'pre-care', 'post-care', 'consultations', 'protocols'],
    specializations: ['botox', 'fillers', 'laser-treatments', 'chemical-peels', 'microneedling']
  },

  emmer: {
    id: 'emmer',
    name: 'Dr. Emmer\'s Dermatology & Plastic Surgery',
    practiceType: 'dermatology',
    systemPrompt: `You are Dr. Emmer's dermatology and plastic surgery AI assistant.

SPECIALIZATION: Surgical protocols, cosmetic consultations, medical dermatology, post-operative care
TONE: Medical authority, detailed, evidence-based, professional
COMPLIANCE: Provide evidence-based recommendations with appropriate medical disclaimers. Reference clinical guidelines when applicable.

Key responsibilities:
- Provide information about dermatological conditions and treatments
- Explain surgical procedures and protocols
- Offer detailed pre-operative and post-operative care instructions
- Assist with cosmetic consultation documentation
- Share evidence-based treatment recommendations
- Support medical dermatology diagnosis assistance
- Provide information about skin cancer screening and prevention
- Help with surgical consent and patient education materials

Always include appropriate medical disclaimers. Emphasize the importance of in-person examination for diagnosis. Reference current clinical guidelines and evidence-based practices.`,
    branding: {
      theme: {
        primary: '#0891B2', // Teal
        secondary: '#E0F2FE',
        accent: '#06B6D4'
      },
      displayName: 'Dr. Emmer - Dermatology'
    },
    documentTypes: ['surgical-protocols', 'consultations', 'medical-conditions', 'post-op-care', 'consent-forms'],
    specializations: ['mohs-surgery', 'cosmetic-surgery', 'medical-dermatology', 'skin-cancer', 'reconstructive']
  }
};

// RAG Function Definition for document search
export const RAG_FUNCTION_DEFINITION = {
  name: 'search_practice_documents',
  description: 'Search practice-specific documents for relevant information to answer user questions',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for finding relevant practice documents'
      },
      tenant: {
        type: 'string',
        enum: ['amanda', 'robbie', 'emmer'],
        description: 'Practice identifier for tenant-specific search'
      },
      documentTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional filter for specific document types (protocols, procedures, policies)'
      },
      topK: {
        type: 'number',
        description: 'Number of relevant documents to retrieve (default: 5)',
        default: 5
      }
    },
    required: ['query', 'tenant']
  }
};

// Helper function to get tenant by ID
export function getTenantConfig(tenantId: TenantId): TenantConfig {
  return TENANT_CONFIGS[tenantId];
}

// Helper function to get all tenant options for dropdown
export function getTenantOptions() {
  return Object.values(TENANT_CONFIGS).map(config => ({
    value: config.id,
    label: config.branding.displayName,
    practiceType: config.practiceType
  }));
}