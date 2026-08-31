"use client";

import { useState } from "react";
import { Upload, Link as LinkIcon, Loader2 } from "lucide-react";

export default function SourceUploader({ onSourceAdded }: { onSourceAdded: (data: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // --- NEW: Trigger the animated progress bar for files ---
    startProgressTracker();
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/file`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      onSourceAdded({ type: "file", name: file.name, ...data.data });
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      // --- NEW: Reset the loading state when finished ---
      setLoading(false);
      setStatus("");
      setProgress(0);
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
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/link`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    // Pass the database ID back so we can delete it later
    onSourceAdded({ id: data.data.document_id, type: "link", name: url, ...data.data });
    setUrl("");
  } catch (error) {
    console.error("Link upload failed", error);
  } finally {
    setLoading(false);
    setStatus("");
  }
};

  return (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
      <h2 className="text-lg font-semibold mb-4">Add Knowledge Sources</h2>
      
      <div className="flex flex-col md:flex-row gap-4">
        {/* File Upload UI */}
        <div className="flex-1">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {loading ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" /> : <Upload className="w-8 h-8 text-gray-400 mb-2" />}
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Upload PDF or PPTX</p>
            </div>
            <input type="file" className="hidden" accept=".pdf,.pptx" onChange={handleFileUpload} disabled={loading} />
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
  );
}