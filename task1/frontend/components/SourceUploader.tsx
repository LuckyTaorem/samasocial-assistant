"use client";

import { useState } from "react";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";

export default function SourceUploader({ onSourceAdded }: { onSourceAdded: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // --- NEW: 5MB File Size Limit Check ---
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      alert("File is too large! Please upload a document smaller than 5MB.");
      
      // --- FIX: Clear the input directly from the event target ---
      e.target.value = ''; 
      return; // Stop execution instantly
    }

    startProgressTracker();
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/api/upload/file`, {
        method: "POST",
        body: formData,
      });

      // --- NEW: Intercept HTTP errors from the backend ---
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`${res.status}: ${errorData.detail || "Upload failed"}`);
      }

      const responseData = await res.json();
      
      // --- FIX: Aggressively hunt for the data dictionary from Python ---
      const doc = responseData?.data || responseData?.result || responseData || {};
      
      // Grab the real ID
      const realId = doc.document_id || doc.id;
      
      if (!realId) {
        console.error("CRITICAL WARNING: The backend did not return a document_id!", responseData);
      }

      // --- FIX: Explicitly map the summary and the real ID so they don't get lost ---
      onSourceAdded({ 
        id: realId || Date.now().toString(), 
        type: "file", 
        name: file.name, 
        summary: doc.summary, 
        ...doc 
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      setErrorToast(error.message);
      setTimeout(() => setErrorToast(null), 4000);
      
    } finally {
      setIsUploading(false);
      // --- FIX: Add these two lines to kill the loading UI ---
      setLoading(false); 
      setStatus("");     
      // ------------------------------------------------------
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const startProgressTracker = () => {
    setLoading(true);
    setStatus("Downloading source content...");
    setProgress(25);
    
    setTimeout(() => {
      setStatus("Generating AI embeddings (this takes a moment)...");
      setProgress(65);
    }, 2000);
    
    setTimeout(() => {
      setStatus("Saving to vector database...");
      setProgress(90);
    }, 6000);
  };

const handleLinkSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!url) return;
  
  startProgressTracker();
  const formData = new FormData();
  formData.append("url", url);

  try {
    const res = await fetch(`${API_URL}/api/upload/link`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    
    // --- FIX: Apply the same bulletproof extraction here ---
    const payload = data?.data || data || {};
    const doc = Array.isArray(payload) ? payload[0] : payload;

    onSourceAdded({ 
      id: doc?.id || doc?.document_id || Date.now().toString(), 
      type: "link", 
      name: url, 
      ...doc 
    });
    
    setUrl("");
  } catch (error) {
    console.error("Link upload failed", error);
  } finally {
    setLoading(false);
    setStatus("");
  }
};

  return (
    <div className="mb-6 relative">
      {/* --- NEW: Error Toast Notification --- */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-2.5 rounded-full shadow-lg text-sm font-semibold text-white bg-red-500 animate-pulse flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
          {errorToast}
        </div>
      )}
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
      <h2 className="text-lg font-semibold mb-4">Add Knowledge Sources</h2>
      
      <div className="flex flex-col md:flex-row gap-4">
        {/* File Upload UI */}
        <div className="flex-1">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {loading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" /> : <Upload className="w-8 h-8 text-gray-400 mb-2" />}
              {/* --- UPDATED: Label text --- */}
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Upload PDF, PPT, or PPTX</p>
            </div>
            {/* --- UPDATED: Added .ppt to the accept attribute --- */}
            <input type="file" className="hidden" accept=".pdf,.ppt,.pptx" onChange={handleFileUpload} disabled={loading} />
          </label>
        </div>

        {/* URL Upload UI */}
        <div className="flex-1 flex flex-col justify-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
          <form onSubmit={handleLinkSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste YouTube or Web URL..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading || !url} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Add Link
            </button>
          </form>
        </div>
      </div>

      {/* Animated Progress Bar */}
      {loading && (
        <div className="mt-5 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
              <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">{status}</span>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-950 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}