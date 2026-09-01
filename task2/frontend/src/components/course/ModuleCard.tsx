"use client";

import { Module, Lesson, Resource } from "@/types/course";
import { BookOpen, Sparkles, Plus, Trash2 } from "lucide-react";

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
    <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs hover:shadow-md transition-all duration-300 mb-6 overflow-hidden group">
      {/* Module Header */}
      <div className="bg-slate-50/70 border-b border-slate-100 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <BookOpen size={18} />
          </div>
          <span className="text-xs font-semibold text-slate-400">Mod {index + 1}</span>
          <input
            type="text"
            value={module.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="font-semibold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-md px-2 py-1 transition-all focus:outline-none w-full text-sm"
          />
        </div>
        <button
          onClick={onDeleteModule}
          className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
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
            <button onClick={handleAddObjective} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium">
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
                  className="w-full text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 transition-all focus:outline-none"
                />
                <button onClick={() => handleRemoveObjective(i)} className="text-slate-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        {module.prerequisites && module.prerequisites.length > 0 && (
          <div className="bg-amber-50/40 p-3 rounded-lg border border-amber-100/60">
            <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Prerequisites
            </h4>
            <p className="text-xs text-slate-600">{module.prerequisites.join(", ")}</p>
          </div>
        )}

        {/* Lessons */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lessons & Resources</h4>
            <button onClick={handleAddLesson} className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium">
              <Plus size={12} /> Add Lesson
            </button>
          </div>
          <div className="space-y-3">
            {module.lessons.map((lesson, i) => (
              <div key={lesson.id} className="bg-slate-50/50 p-3.5 rounded-lg border border-slate-100 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-semibold text-slate-400">{i + 1}.</span>
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(e) => handleLessonChange(i, { ...lesson, title: e.target.value })}
                      className="font-medium text-slate-800 text-xs bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 transition-all focus:outline-none w-full"
                    />
                  </div>
                  
                  {/* Editable Difficulty Selector */}
                  <select
                    value={lesson.difficulty}
                    onChange={(e) => handleLessonChange(i, { ...lesson, difficulty: e.target.value })}
                    className={`text-[10px] px-2 py-1 rounded-md font-medium border cursor-pointer outline-none ${
                      lesson.difficulty === 'Beginner' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      lesson.difficulty === 'Intermediate' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>

                  <button onClick={() => handleRemoveLesson(i)} className="text-slate-400 hover:text-red-500 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="px-5">
                  <input
                    type="text"
                    value={lesson.topics.join(", ")}
                    onChange={(e) => handleLessonChange(i, { ...lesson, topics: e.target.value.split(",").map(s => s.trim()) })}
                    className="w-full text-[11px] text-slate-500 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-1 py-0.5"
                    placeholder="Topics separated by comma"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module Assessment */}
        <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100/60">
          <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Module Assessment</h4>
          <input
            type="text"
            value={module.assessment}
            onChange={(e) => onUpdateModule({ ...module, assessment: e.target.value })}
            className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-1 py-0.5 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}