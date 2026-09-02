"use client";

import { Module, Lesson, Resource } from "@/types/course";
import { BookOpen, Sparkles, Plus, Trash2, ExternalLink, Link2 } from "lucide-react";

interface ModuleCardProps {
  module: Module;
  index: number;
  onUpdateModule: (updatedModule: Module) => void;
  onDeleteModule: () => void;
}

export default function ModuleCard({ module, index, onUpdateModule, onDeleteModule }: ModuleCardProps) {
  const handleTitleChange = (newTitle: string) => {
    onUpdateModule({ ...module, title: newTitle });
  };

  // Learning Objectives Handlers
  const handleObjectiveChange = (objIndex: number, value: string) => {
    const updated = [...module.learningObjectives];
    updated[objIndex] = value;
    onUpdateModule({ ...module, learningObjectives: updated });
  };

  const handleAddObjective = () => {
    onUpdateModule({ ...module, learningObjectives: [...module.learningObjectives, "New Learning Objective"] });
  };

  const handleRemoveObjective = (objIndex: number) => {
    const updated = module.learningObjectives.filter((_, i) => i !== objIndex);
    onUpdateModule({ ...module, learningObjectives: updated });
  };

  // Lesson Handlers
  const handleLessonChange = (lessonIndex: number, updatedLesson: Lesson) => {
    const updatedLessons = [...module.lessons];
    updatedLessons[lessonIndex] = updatedLesson;
    onUpdateModule({ ...module, lessons: updatedLessons });
  };

  const handleAddLesson = () => {
    const newLesson: Lesson = {
      id: Date.now().toString(),
      title: "New Lesson Title",
      topics: ["Topic 1"],
      difficulty: "Beginner",
      resources: [{ id: "1", title: "Documentation / Video", type: "Documentation", url: "https://example.com" }],
      assessment: "Lesson quiz or check"
    };
    onUpdateModule({ ...module, lessons: [...module.lessons, newLesson] });
  };

  const handleRemoveLesson = (lessonIndex: number) => {
    const updatedLessons = module.lessons.filter((_, i) => i !== lessonIndex);
    onUpdateModule({ ...module, lessons: updatedLessons });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs hover:shadow-md transition-all duration-300 mb-6 overflow-hidden group">

      {/* Module Header */}
      <div className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between gap-3 print:bg-slate-50 print:border-slate-200">
        <div className="flex items-center gap-3 flex-1">
          
          {/* --- FIXED MODULE BADGE --- */}
          <div className="flex flex-col items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 min-w-[64px] print:bg-blue-50 print:text-blue-700">
            <BookOpen size={16} className="mb-0.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Module {index + 1}</span>
          </div>
          {/* ------------------------- */}

          <input
            type="text"
            value={module.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="font-semibold text-slate-800 dark:text-slate-200 bg-transparent focus:bg-white dark:focus:bg-slate-950 rounded-md px-2 py-1 transition-all focus:outline-none w-full text-sm print:text-black print:p-0"
          />
        </div>
        <button
          onClick={onDeleteModule}
          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors print:hidden print:hidden"
          title="Delete Module"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Learning Objectives */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Learning Objectives</h4>
            <button onClick={handleAddObjective} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium print:hidden">
              <Plus size={12} /> Add Objective
            </button>
          </div>
          <div className="space-y-1.5">
            {module.learningObjectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={obj}
                  onChange={(e) => handleObjectiveChange(i, e.target.value)}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 rounded px-2 py-1 transition-all focus:outline-none"
                />
                <button onClick={() => handleRemoveObjective(i)} className="text-slate-300 hover:text-red-500 print:hidden">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        {module.prerequisites && module.prerequisites.length > 0 && (
          <div className="bg-amber-50/40 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-100/60 dark:border-amber-500/20 transition-colors">
            <h4 className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Prerequisites
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">{module.prerequisites.join(", ")}</p>
          </div>
        )}

        {/* Lessons */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lessons & Resources</h4>
            <button onClick={handleAddLesson} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium print:hidden">
              <Plus size={12} /> Add Lesson
            </button>
          </div>
          <div className="space-y-3">
            {module.lessons.map((lesson, i) => (
              <div key={lesson.id} className="bg-slate-50/50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-100 dark:border-slate-700 space-y-2">
                
                {/* --- LESSON HEADER ROW --- */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-semibold text-slate-400">{i + 1}.</span>
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(e) => handleLessonChange(i, { ...lesson, title: e.target.value })}
                      className="font-medium text-slate-800 dark:text-slate-200 text-xs bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 rounded px-2 py-1 transition-all focus:outline-none w-full"
                    />
                  </div>
                  
                  <select
                    value={lesson.difficulty}
                    onChange={(e) => handleLessonChange(i, { ...lesson, difficulty: e.target.value })}
                    className={`text-[10px] px-2 py-1 rounded-md font-medium border cursor-pointer outline-none transition-colors ${
                      lesson.difficulty === 'Beginner' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
                      lesson.difficulty === 'Intermediate' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
                    }`}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>

                  <button onClick={() => handleRemoveLesson(i)} className="text-slate-400 hover:text-red-500 ml-1 print:hidden">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* --- LESSON CONTENT (Topics, Resources, Assessments) --- */}
                <div className="px-5 space-y-3 mt-1">
                  
                  {/* Topics */}
                  <input
                    type="text"
                    value={lesson.topics.join(", ")}
                    onChange={(e) => handleLessonChange(i, { ...lesson, topics: e.target.value.split(",").map(s => s.trim()) })}
                    className="w-full text-[11px] text-slate-500 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-1 py-0.5"
                    placeholder="Topics separated by comma"
                  />
                  
                  {/* --- SLEEK LESSON RESOURCES UI --- */}
                  <div className="mt-3 bg-slate-100/50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50 transition-colors">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recommended Resources</h5>
                      <button 
                        onClick={() => {
                          const updatedRes = [...lesson.resources, { title: "New Resource", type: "Web", url: "" }];
                          handleLessonChange(i, { ...lesson, resources: updatedRes });
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium print:hidden"
                      >
                        <Plus size={10} /> Add Link
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {lesson.resources.map((res, rIdx) => (
                        <div key={rIdx} className="group flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all shadow-sm">
                          
                          <Link2 size={13} className="text-slate-400 shrink-0" />
                          
                          {/* Editable Title */}
                          <input
                            type="text"
                            value={res.title}
                            onChange={(e) => {
                              const updatedRes = [...lesson.resources];
                              updatedRes[rIdx].title = e.target.value;
                              handleLessonChange(i, { ...lesson, resources: updatedRes });
                            }}
                            placeholder="Resource Title"
                            className="w-1/3 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-transparent outline-none truncate"
                          />
                          
                          <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                          
                          {/* Editable URL */}
                          <input
                            type="text"
                            value={res.url}
                            onChange={(e) => {
                              const updatedRes = [...lesson.resources];
                              updatedRes[rIdx].url = e.target.value;
                              handleLessonChange(i, { ...lesson, resources: updatedRes });
                            }}
                            placeholder="Paste URL here..."
                            className="flex-1 text-[11px] text-slate-500 dark:text-slate-400 bg-transparent outline-none truncate"
                          />
                          
                          {/* Clickable External Link */}
                          <a
                            href={res.url.startsWith('http') ? res.url : `https://${res.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors p-0.5"
                            title="Open Link in New Tab"
                          >
                            <ExternalLink size={13} />
                          </a>

                          {/* Delete Resource Button (Appears on Hover) */}
                          <button
                            onClick={() => {
                              const updatedRes = lesson.resources.filter((_, idx) => idx !== rIdx);
                              handleLessonChange(i, { ...lesson, resources: updatedRes });
                            }}
                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-0.5 opacity-0 group-hover:opacity-100 print:hidden"
                            title="Remove Link"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* --- PRACTICE EXERCISES ARRAY UI --- */}
                  <div className="mt-3 bg-purple-50/40 dark:bg-purple-950/20 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/30 transition-colors">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <h5 className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Practice Exercises (LeetCode, HackerRank, etc.)</h5>
                      <button 
                        onClick={() => {
                          const currentExercises = lesson.practiceExercises || [];
                          const updatedExercises = [...currentExercises, { title: "Coding Challenge", type: "LeetCode", url: "" }];
                          handleLessonChange(i, { ...lesson, practiceExercises: updatedExercises });
                        }}
                        className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <Plus size={10} /> Add Practice Link
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {(lesson.practiceExercises || []).map((ex, exIdx) => (
                        <div key={exIdx} className="group flex items-center gap-2 bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-900/50 rounded-md px-2 py-1.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all shadow-sm">
                          
                          {/* Editable Title */}
                          <input
                            type="text"
                            value={ex.title}
                            onChange={(e) => {
                              const updatedExercises = [...(lesson.practiceExercises || [])];
                              updatedExercises[exIdx].title = e.target.value;
                              handleLessonChange(i, { ...lesson, practiceExercises: updatedExercises });
                            }}
                            placeholder="Exercise Title"
                            className="w-1/3 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-transparent outline-none truncate"
                          />
                          
                          <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>
                          
                          {/* Editable URL */}
                          <input
                            type="text"
                            value={ex.url}
                            onChange={(e) => {
                              const updatedExercises = [...(lesson.practiceExercises || [])];
                              updatedExercises[exIdx].url = e.target.value;
                              handleLessonChange(i, { ...lesson, practiceExercises: updatedExercises });
                            }}
                            placeholder="Paste LeetCode/HackerRank URL..."
                            className="flex-1 text-[11px] text-purple-600 dark:text-purple-400 bg-transparent outline-none truncate"
                          />

                          {/* Clickable External Link */}
                          <a
                            href={ex.url.startsWith('http') ? ex.url : `https://${ex.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors p-0.5"
                            title="Open Link in New Tab"
                          >
                            <ExternalLink size={13} />
                          </a>

                          {/* Delete Exercise Button */}
                          <button
                            onClick={() => {
                              const updatedExercises = (lesson.practiceExercises || []).filter((_, idx) => idx !== exIdx);
                              handleLessonChange(i, { ...lesson, practiceExercises: updatedExercises });
                            }}
                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-0.5 opacity-0 group-hover:opacity-100"
                            title="Remove Exercise"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lesson Assessment */}
                  <div>
                    <input
                      type="text"
                      value={lesson.assessment || ""}
                      onChange={(e) => handleLessonChange(i, { ...lesson, assessment: e.target.value })}
                      placeholder="Lesson Assessment / Quiz..."
                      className="w-full text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded px-2 py-1 focus:outline-none focus:border-emerald-300"
                    />
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module Assessment */}
        <div className="bg-blue-50/40 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100/60 dark:border-blue-900/50">
          <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1">Module Assessment</h4>
          <input
            type="text"
            value={module.assessment}
            onChange={(e) => onUpdateModule({ ...module, assessment: e.target.value })}
            className="w-full text-xs text-slate-700 dark:text-slate-300 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-950 rounded px-1 py-0.5 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}