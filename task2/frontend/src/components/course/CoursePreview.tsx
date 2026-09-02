"use client";

import { useEffect, useRef } from "react";
import { CoursePlan, Module } from "@/types/course";
import ModuleCard from "./ModuleCard";
import { Download, Plus, Printer } from "lucide-react";

interface Props {
  coursePlan: CoursePlan | null;
  setCoursePlan: React.Dispatch<React.SetStateAction<CoursePlan | null>>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CoursePreview({ coursePlan, setCoursePlan }: Props) {
  const isInitialMount = useRef(true);

  const savePlanToDB = async (planToSave: CoursePlan) => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session");
    if (!sid) return;

    try {
      await fetch(`${API_URL}/api/sessions/${sid}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planToSave)
      });
    } catch (e) {
      console.error("Manual save failed", e);
    }
  };

  if (!coursePlan) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3 bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 border-t-transparent"></div>
        <p className="text-xs font-medium">Chat with the AI or upload a syllabus to generate your course plan...</p>
      </div>
    );
  }

  const handleUpdateModule = (index: number, updatedModule: Module) => {
    const updatedModules = [...coursePlan.modules];
    updatedModules[index] = updatedModule;
    const newPlan = { ...coursePlan, modules: updatedModules };
    setCoursePlan(newPlan);
    savePlanToDB(newPlan); // <-- Saves on edit
  };

  const handleDeleteModule = (index: number) => {
    const updatedModules = coursePlan.modules.filter((_, i) => i !== index);
    const newPlan = { ...coursePlan, modules: updatedModules };
    setCoursePlan(newPlan);
    savePlanToDB(newPlan); // <-- Saves on delete
  };

  const handleAddModule = () => {
    const newModule: Module = {
      id: Date.now().toString(),
      title: "New Course Module",
      learningObjectives: ["Define core concepts of this module"],
      prerequisites: ["Basic understanding of prior modules"],
      lessons: [
        {
          id: Date.now().toString() + "-1",
          title: "Introduction Lesson",
          topics: ["Overview", "Core Principles"],
          difficulty: "Beginner",
          resources: [{ title: "Reference Docs", type: "Documentation", url: "https://example.com" }],
          assessment: "Review questions"
        }
      ],
      assessment: "Module project or quiz"
    };
    const newPlan = { ...coursePlan, modules: [...coursePlan.modules, newModule] };
    setCoursePlan(newPlan);
    savePlanToDB(newPlan); // <-- Saves on add
  };

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. INTERACTIVE UI (COMPLETELY HIDDEN ON PDF EXPORT)                   */}
      {/* ===================================================================== */}
      <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 transition-colors print:hidden">
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center shadow-xs transition-colors">
          <div>
            <input
              type="text"
              value={coursePlan.subject}
              onChange={(e) => setCoursePlan({ ...coursePlan, subject: e.target.value })}
              className="w-full text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 rounded px-1 outline-none transition-colors"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 px-1">
              Audience: {coursePlan.targetAudience} | Duration: {coursePlan.duration}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-xs"
            >
              <Printer size={14} /> Save PDF
            </button>
            
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
              className="w-full py-3.5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl text-slate-500 hover:text-blue-600 font-medium text-xs flex items-center justify-center gap-2 transition-all bg-white/50"
            >
              <Plus size={16} /> Add New Module
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DEDICATED PDF TEMPLATE (ONLY VISIBLE WHEN SAVING TO PDF)           */}
      {/* ===================================================================== */}
      <div className="hidden print:block w-full bg-white text-black font-sans">
        
        {/* --- PAGE 1: COVER PAGE --- */}
        <div className="flex flex-col items-center justify-center h-screen text-center px-10" style={{ pageBreakAfter: 'always' }}>
          <p className="text-sm font-bold text-blue-600 uppercase tracking-[0.2em] mb-6">AI Course Planner</p>
          <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-8 max-w-4xl">
            {coursePlan.subject}
          </h1>
          <div className="w-24 h-1.5 bg-blue-600 rounded-full mb-8"></div>
          <div className="flex flex-col gap-2 text-lg text-slate-600 font-medium">
            <p>Target Audience: <span className="text-slate-900">{coursePlan.targetAudience}</span></p>
            <p>Estimated Duration: <span className="text-slate-900">{coursePlan.duration}</span></p>
          </div>
        </div>

        {/* --- PAGE 2+: MODULES --- */}
        {coursePlan.modules.map((module, idx) => (
          <div key={module.id} style={{ pageBreakBefore: 'always' }} className="pt-10 pb-8 px-8 max-w-4xl mx-auto">
            
            {/* Module Header */}
            <div className="border-b-2 border-slate-200 pb-4 mb-8">
              <span className="text-sm font-bold text-blue-600 uppercase tracking-widest block mb-2">Module {idx + 1}</span>
              <h2 className="text-3xl font-bold text-slate-900">{module.title}</h2>
            </div>

            {/* Learning Objectives */}
            <div className="mb-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Learning Objectives</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
                {module.learningObjectives.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            </div>

            {/* Prerequisites */}
            {module.prerequisites && module.prerequisites.length > 0 && (
              <div className="mb-8 p-4 bg-amber-50/50 border border-amber-100 rounded-lg">
                <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Prerequisites</h3>
                <p className="text-sm text-slate-700">{module.prerequisites.join(", ")}</p>
              </div>
            )}

            {/* Lessons */}
            <div className="space-y-8">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Lessons</h3>
              
              {module.lessons.map((lesson, lIdx) => (
                <div key={lesson.id} className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 break-inside-avoid">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-lg font-bold text-slate-800">{lIdx + 1}. {lesson.title}</h4>
                    <span className="px-2.5 py-0.5 text-[10px] uppercase font-bold rounded-full border border-slate-200 text-slate-500 bg-white shadow-xs">
                      {lesson.difficulty}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    <span className="font-semibold text-slate-700">Topics:</span> {lesson.topics.join(", ")}
                  </p>

                  {/* Clean Resources List */}
                  {lesson.resources && lesson.resources.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resources</p>
                      <ul className="space-y-1.5 text-sm">
                        {lesson.resources.map((res, rIdx) => (
                          <li key={rIdx} className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                            <span className="text-slate-700 font-medium">{res.title}</span>
                            <span className="text-slate-300 text-xs">—</span>
                            <a href={res.url} className="text-blue-600 underline truncate max-w-xs">{res.url}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* --- RENDER PRACTICE EXERCISES IN PDF --- */}
                  {lesson.practiceExercises && lesson.practiceExercises.length > 0 && (
                    <div className="mb-4 bg-purple-50/40 border border-purple-100 p-3 rounded-lg">
                      <p className="text-[11px] font-bold text-purple-700 uppercase tracking-widest mb-2">Practice Exercises (LeetCode, HackerRank, etc.)</p>
                      <ul className="space-y-1.5 text-sm">
                        {lesson.practiceExercises.map((ex, exIdx) => {
                          const validUrl = ex.url.match(/^https?:\/\//) ? ex.url : `https://${ex.url}`;
                          return (
                            <li key={exIdx} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 shrink-0"></span>
                              <span className="text-slate-700 font-medium whitespace-nowrap">{ex.title}</span>
                              <span className="text-slate-300 text-xs mt-0.5">—</span>
                              <a 
                                href={validUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-purple-600 underline break-all hover:text-purple-800"
                              >
                                {validUrl}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Clean Assessment */}
                  {lesson.assessment && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-sm text-slate-700">
                        <span className="font-bold text-emerald-700 mr-2">Assessment:</span> 
                        {lesson.assessment}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Module Assessment */}
            {module.assessment && (
              <div className="mt-10 p-5 bg-blue-50/40 border border-blue-100 rounded-xl break-inside-avoid">
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Module Assessment</h3>
                <p className="text-sm text-slate-800 font-medium">{module.assessment}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}