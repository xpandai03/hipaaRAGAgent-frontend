'use client';

import { useState, useEffect } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [defaultTenant, setDefaultTenant] = useState('amanda');
  const [enableRAG, setEnableRAG] = useState(false);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.systemPrompt || '');
        if (data.settings) {
          setDefaultTenant(data.settings.defaultTenant || 'amanda');
          setEnableRAG(data.settings.enableRAG || false);
          setMaxTokens(data.settings.maxTokens || 1000);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemPrompt,
          defaultTenant,
          enableRAG,
          maxTokens,
        }),
      });

      if (response.ok) {
        // Show success message
        alert('Settings saved successfully!');
        onClose();
      } else {
        console.error('Failed to save settings');
        alert('Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSystemPrompt('You are HIPAA GPT, a helpful medical AI assistant. Provide clear, accurate, and professional responses.');
    setDefaultTenant('amanda');
    setEnableRAG(false);
    setMaxTokens(1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading settings...</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Enter the system prompt for the AI assistant..."
              />
              <p className="mt-1 text-sm text-gray-500">
                This prompt defines the assistant's behavior and personality
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Tenant
              </label>
              <select
                value={defaultTenant}
                onChange={(e) => setDefaultTenant(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="amanda">Amanda</option>
                <option value="hipaa">HIPAA</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1000)}
                min="100"
                max="4000"
                step="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Maximum number of tokens in the AI response (100-4000)
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="enableRAG"
                checked={enableRAG}
                onChange={(e) => setEnableRAG(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="enableRAG" className="text-sm font-medium text-gray-700">
                Enable RAG (Retrieval-Augmented Generation)
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={resetToDefault}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Reset to Default
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}