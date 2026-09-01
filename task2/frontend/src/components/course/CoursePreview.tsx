"use client";

import { CoursePlan, Module } from "@/types/course";
import ModuleCard from "./ModuleCard";
import { Download, Plus } from "lucide-react";

interface Props {
  coursePlan: CoursePlan | null;
  setCoursePlan: React.Dispatch<React.SetStateAction<CoursePlan | null>>;
}

export default function CoursePreview({ coursePlan, setCoursePlan }: Props) {
  if (!coursePlan) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3 bg-slate-50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 border-t-transparent"></div>
        <p className="text-xs font-medium">Chat with the AI or upload a syllabus to generate your course plan...</p>
      </div>
    );
  }

  const handleUpdateModule = (index: number, updatedModule: Module) => {
    const updatedModules = [...coursePlan.modules];
    updatedModules[index] = updatedModule;
    setCoursePlan({ ...coursePlan, modules: updatedModules });
  };

  const handleDeleteModule = (index: number) => {
    const updatedModules = coursePlan.modules.filter((_, i) => i !== index);
    setCoursePlan({ ...coursePlan, modules: updatedModules });
  };

  const handleAddModule = () => {
    const newModule: Module = {
      id: Date.now().toString(),
      title: "New Course Module",
      learningObjectives: ["Define core concepts of this module"],
      prerequisites: ["Basic understanding of prior modules"],
      lessons: [
        {
          id: "1",
          title: "Introduction Lesson",
          topics: ["Overview", "Core Principles"],
          difficulty: "Beginner",
          resources: [{ id: "1", title: "Reference Docs", type: "Documentation", url: "https://example.com" }],
          assessment: "Review questions"
        }
      ],
      assessment: "Module project or quiz"
    };
    setCoursePlan({ ...coursePlan, modules: [...coursePlan.modules, newModule] });
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <div className="px-6 py-4 bg-white border-b border-slate-200/80 flex justify-between items-center shadow-xs">
        <div>
          <input
            type="text"
            value={coursePlan.subject}
            onChange={(e) => setCoursePlan({ ...coursePlan, subject: e.target.value })}
            className="text-lg font-bold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 rounded px-1 outline-none"
          />
          <p className="text-xs text-slate-400 mt-0.5 px-1">
            Audience: {coursePlan.targetAudience} | Duration: {coursePlan.duration}
          </p>
        </div>
        <button 
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-xs"
          onClick={() => {
            const blob = new Blob([JSON.stringify(coursePlan, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'course-plan.json';
            a.click();
          }}
        >
          <Download size={14} /> Export JSON
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {coursePlan.modules.map((module, idx) => (
            <ModuleCard 
              key={module.id || idx} 
              index={idx} 
              module={module} 
              onUpdateModule={(updatedMod) => handleUpdateModule(idx, updatedMod)}
              onDeleteModule={() => handleDeleteModule(idx)}
            />
          ))}

          <button
            onClick={handleAddModule}
            className="w-full py-3.5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl text-slate-500 hover:text-blue-600 font-medium text-xs flex items-center justify-center gap-2 transition-all bg-white/50 hover:bg-blue-50/20"
          >
            <Plus size={16} /> Add New Module
          </button>
        </div>
      </div>
    </div>
  );
}