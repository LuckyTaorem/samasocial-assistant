export interface Resource {
  id?: string; // Added optional id property
  title: string;
  type: string;
  url: string;
}

export interface Lesson {
  id: string;
  title: string;
  topics: string[];
  difficulty: string; // Changed from strict union to string to support select inputs
  resources: Resource[];
  assessment?: string;
}

export interface Module {
  id: string;
  title: string;
  learningObjectives: string[];
  prerequisites?: string[];
  lessons: Lesson[];
  assessment: string;
}

export interface CoursePlan {
  subject: string;
  targetAudience: string;
  duration: string;
  modules: Module[];
}