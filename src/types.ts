export interface Homework {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  subject: string;
  reminderOption?: 'none' | '1h' | '1d' | '2d';
  reminderTime?: string;
  reminderSent?: boolean;
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

export type View = 'home' | 'homework' | 'timer' | 'exams' | 'profile' | 'chat' | 'developer';

export interface UserProfileData {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  lastSeen?: string;
}

export interface GroupChat {
  id: string;
  name: string;
  description: string;
  createdAt: any;
  createdBy: string;
  deletedBy?: string[];
}

export interface DirectChat {
  id: string;
  participants: string[];
  updatedAt: any;
  lastMessage?: string;
  deletedBy?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  timestamp: any;
}
