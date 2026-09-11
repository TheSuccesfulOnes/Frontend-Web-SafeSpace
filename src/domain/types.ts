export type Role = "EMPLOYEE" | "HR_MEMBER" | "SYSTEM_ADMIN";

export type AuthSession = {
  token: string;
  username: string;
  displayName: string;
  role: Role;
  userId: number;
};

export type Language = "es" | "en";
export type Theme = "light" | "dark";

export type Profile = {
  username: string;
  email: string | null;
  displayName: string;
  role: Role;
  language: Language;
  theme: Theme;
  userId: number;
};

export type Mood = "VERY_BAD" | "BAD" | "GOOD" | "VERY_GOOD";

export type MoodToday = {
  mood: Mood;
  date: string;
};

export type MoodSummary = {
  date: string;
  totalResponses: number;
  distribution: Partial<Record<Mood, number>>;
  activeEmployees: number;
  responseRate: number;
};

export type SurveyType = "DAILY" | "WEEKLY";
export type SurveyStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export type Survey = {
  id: number;
  title: string;
  question: string;
  type: SurveyType;
  status: SurveyStatus;
  allowComments: boolean;
  answers: number;
  answered: boolean;
};

export type Comment = {
  id: number;
  content: string;
  likes: number;
  canDelete: boolean;
  createdAt: string;
  replies: Comment[];
};

export type ActivityStatus = "OPEN" | "CLOSED";
export type ActivityOption = {
  id: number;
  label: string;
  votes: number;
  percentage: number;
};

export type Activity = {
  id: number;
  title: string;
  description: string;
  status: ActivityStatus;
  options: ActivityOption[];
};

export type ReportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ReportStatus = "NEW" | "IN_REVIEW" | "ADDRESSED" | "CLOSED";

export type Report = {
  id: number;
  category: string;
  title: string;
  description: string;
  priority: ReportPriority;
  status: ReportStatus;
  anonymous: boolean;
  reporterDisplayName: string | null;
  createdAt: string;
};

export type AiConversation = {
  id: number;
  title: string;
};

export type AiMessage = {
  id: number;
  sender: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

export type PageKey =
  "home" | "surveys" | "ai" | "management" | "reports" | "settings" | "profile";
