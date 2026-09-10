import type { AiConversation, AiMessage, Language } from "../../domain/types";
import { apiRequest } from "../api/apiClient";

type ApiMessage = Omit<AiMessage, "createdAt"> & { created_at: string };

function mapMessage(message: ApiMessage): AiMessage {
  return { ...message, createdAt: message.created_at };
}

export function getConversations(token: string): Promise<AiConversation[]> {
  return apiRequest<AiConversation[]>("/api/v1/ai/conversations", { token });
}

export function createConversation(token: string): Promise<AiConversation> {
  return apiRequest<AiConversation>("/api/v1/ai/conversations", {
    method: "POST",
    token,
  });
}

export function renameConversation(
  token: string,
  id: number,
  title: string,
): Promise<AiConversation> {
  return apiRequest<AiConversation>(`/api/v1/ai/conversations/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ title: title.trim() }),
  });
}

export function deleteConversation(token: string, id: number): Promise<void> {
  return apiRequest<void>(`/api/v1/ai/conversations/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function getMessages(
  token: string,
  id: number,
): Promise<AiMessage[]> {
  const data = await apiRequest<ApiMessage[]>(
    `/api/v1/ai/conversations/${id}/messages`,
    { token },
  );
  return data.map(mapMessage);
}

export async function sendMessage(
  token: string,
  id: number,
  content: string,
  language: Language,
): Promise<AiMessage[]> {
  const data = await apiRequest<ApiMessage[]>(
    `/api/v1/ai/conversations/${id}/messages`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ content: content.trim(), language }),
    },
  );
  return data.map(mapMessage);
}
