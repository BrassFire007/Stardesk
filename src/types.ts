export interface Homework {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  subject: string;
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  rank?: number;
}

export type View = 'home' | 'homework' | 'timer' | 'exams' | 'profile';
