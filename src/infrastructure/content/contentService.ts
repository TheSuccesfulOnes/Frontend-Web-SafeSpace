import type {
  Activity,
  Comment,
  Mood,
  MoodSummary,
  MoodToday,
  Report,
  ReportPriority,
  ReportStatus,
  Survey,
} from "../../domain/types";
import { apiRequest } from "../api/apiClient";

type ApiSurvey = Omit<Survey, "allowComments"> & { allow_comments: boolean };
type ApiComment = Omit<Comment, "canDelete" | "createdAt" | "replies"> & {
  created_at: string;
  can_delete: boolean;
  replies?: ApiComment[];
};
type ApiMoodSummary = {
  date: string;
  total_responses: number;
  distribution: Partial<Record<Mood, number>>;
  active_employees: number;
  response_rate: number;
};
type ApiReport = Omit<Report, "reporterDisplayName" | "createdAt"> & {
  reporter_display_name: string | null;
  created_at: string;
};

function mapSurvey(survey: ApiSurvey): Survey {
  return { ...survey, allowComments: survey.allow_comments };
}

function mapComment(comment: ApiComment): Comment {
  return {
    ...comment,
    canDelete: comment.can_delete,
    createdAt: comment.created_at,
    replies: comment.replies?.map(mapComment) ?? [],
  };
}

function mapMoodSummary(summary: ApiMoodSummary): MoodSummary {
  return {
    date: summary.date,
    totalResponses: summary.total_responses,
    distribution: summary.distribution,
    activeEmployees: summary.active_employees,
    responseRate: summary.response_rate,
  };
}

function mapReport(report: ApiReport): Report {
  return {
    ...report,
    reporterDisplayName: report.reporter_display_name,
    createdAt: report.created_at,
  };
}

export async function getTodayMood(token: string): Promise<MoodToday | null> {
  return apiRequest<MoodToday | null>("/api/v1/mood/today", { token });
}

export async function submitMood(
  token: string,
  mood: Mood,
): Promise<MoodToday> {
  return apiRequest<MoodToday>("/api/v1/mood/today", {
    method: "POST",
    token,
    body: JSON.stringify({ mood }),
  });
}

export async function getMoodSummary(token: string): Promise<MoodSummary> {
  const data = await apiRequest<ApiMoodSummary>("/api/v1/mood/summary", {
    token,
  });
  return mapMoodSummary(data);
}

export async function getSurveys(token: string): Promise<Survey[]> {
  const data = await apiRequest<ApiSurvey[]>("/api/v1/surveys", { token });
  return data.map(mapSurvey);
}

export async function answerSurvey(
  token: string,
  id: number,
  answerText: string,
): Promise<void> {
  await apiRequest<void>(`/api/v1/surveys/${id}/answers`, {
    method: "POST",
    token,
    body: JSON.stringify({ answer_text: answerText.trim() }),
  });
}

export async function getComments(
  token: string,
  surveyId: number,
): Promise<Comment[]> {
  const data = await apiRequest<ApiComment[]>(
    `/api/v1/surveys/${surveyId}/comments`,
    { token },
  );
  return data.map(mapComment);
}

export async function addComment(
  token: string,
  surveyId: number,
  content: string,
  parentId?: number,
): Promise<Comment> {
  const response = await apiRequest<ApiComment>(
    `/api/v1/surveys/${surveyId}/comments`,
    {
      method: "POST",
      token,
      body: JSON.stringify({
        content: content.trim(),
        parent_id: parentId ?? null,
      }),
    },
  );
  return mapComment(response);
}

export async function likeComment(
  token: string,
  surveyId: number,
  commentId: number,
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/surveys/${surveyId}/comments/${commentId}/like`,
    { method: "POST", token },
  );
}

export async function deleteComment(
  token: string,
  surveyId: number,
  commentId: number,
): Promise<void> {
  await apiRequest<void>(`/api/v1/surveys/${surveyId}/comments/${commentId}`, {
    method: "DELETE",
    token,
  });
}

export async function getActivities(token: string): Promise<Activity[]> {
  return apiRequest<Activity[]>("/api/v1/activities", { token });
}

export async function voteActivity(
  token: string,
  id: number,
  optionId: number,
): Promise<void> {
  await apiRequest<void>(`/api/v1/activities/${id}/votes`, {
    method: "POST",
    token,
    body: JSON.stringify({ option_id: optionId }),
  });
}

export async function getManagedSurveys(token: string): Promise<Survey[]> {
  const data = await apiRequest<ApiSurvey[]>("/api/v1/surveys/managed", {
    token,
  });
  return data.map(mapSurvey);
}

export async function getManagedActivities(token: string): Promise<Activity[]> {
  return apiRequest<Activity[]>("/api/v1/activities/managed", { token });
}

export async function createSurvey(
  token: string,
  input: {
    title: string;
    question: string;
    type: "DAILY" | "WEEKLY";
    allowComments: boolean;
  },
): Promise<Survey> {
  const response = await apiRequest<ApiSurvey>("/api/v1/surveys", {
    method: "POST",
    token,
    body: JSON.stringify({
      ...input,
      allowComments: undefined,
      allow_comments: input.allowComments,
    }),
  });
  return mapSurvey(response);
}

export async function changeSurveyStatus(
  token: string,
  id: number,
  action: "publish" | "close",
): Promise<Survey> {
  const response = await apiRequest<ApiSurvey>(
    `/api/v1/surveys/${id}/${action}`,
    { method: "POST", token },
  );
  return mapSurvey(response);
}

export async function createActivity(
  token: string,
  input: { title: string; description: string; options: string[] },
): Promise<Activity> {
  return apiRequest<Activity>("/api/v1/activities", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function closeActivity(token: string, id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/activities/${id}/close`, {
    method: "POST",
    token,
  });
}

export async function createReport(
  token: string,
  input: {
    category: string;
    title: string;
    description: string;
    priority: ReportPriority;
    anonymous: boolean;
  },
): Promise<Report> {
  const response = await apiRequest<ApiReport>("/api/v1/reports", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  return mapReport(response);
}

export async function getMyReports(token: string): Promise<Report[]> {
  const data = await apiRequest<ApiReport[]>("/api/v1/reports/mine", { token });
  return data.map(mapReport);
}

export async function getAllReports(token: string): Promise<Report[]> {
  const data = await apiRequest<ApiReport[]>("/api/v1/reports", { token });
  return data.map(mapReport);
}

export async function updateReportStatus(
  token: string,
  id: number,
  status: ReportStatus,
): Promise<Report> {
  const response = await apiRequest<ApiReport>(`/api/v1/reports/${id}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
  return mapReport(response);
}
