import { describe, it, expect, vi } from "vitest";
import { EmployeeAiPage } from "../src/contexts/ai/presentation/EmployeeAiPage";
import {
  mount,
  button,
  field,
  change,
  submit,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  deferred,
  t,
} from "./helpers";
const conversation = { id: 7, title: "My conversation" };
const prefix = "/api/v1/ai/conversations";
async function ai(
  extra: Record<string, any> = {},
  language: "es" | "en" = "es",
  open = true,
) {
  const net = network({
    [`GET ${prefix}`]: [conversation],
    [`GET ${prefix}/7/messages`]: [],
    ...extra,
  });
  const onUnauthorized = vi.fn();
  const view = mount(
    <EmployeeAiPage
      token={token}
      language={language}
      onUnauthorized={onUnauthorized}
    />,
  );
  const entry = await screen.findByRole("button", { name: conversation.title });
  if (open) {
    fireEvent.click(entry);
    await screen.findByPlaceholderText(t.messagePlaceholder);
  }
  return { ...net, ...view, onUnauthorized };
}
function composer() {
  return screen.getByPlaceholderText(t.messagePlaceholder);
}
describe("src/contexts/ai/presentation/EmployeeAiPage.tsx | integration", () => {
  it.each(["", " ", "\t\n"])("blocks blank message %j", async (value) => {
    const net = await ai();
    change(composer(), value);
    submit(composer());
    expect(net.mutations()).toHaveLength(0);
    expect(button("send")).toBeDisabled();
  });
  it.each([
    ["trim", " hello ", "es"],
    ["Unicode", "Ánimo 林 🔒", "en"],
    ["4000 boundary", "a".repeat(4000), "es"],
  ])("sends %s content and language", async (_name, content, language) => {
    const messages = [
      {
        id: 8,
        sender: "ASSISTANT",
        content: "Local answer",
        created_at: "2026-01-01",
      },
    ];
    const net = await ai(
      { [`POST ${prefix}/7/messages`]: messages },
      language as "es" | "en",
    );
    change(composer(), content);
    submit(composer());
    await screen.findByText("Local answer");
    expect(net.mutations()[0].body).toEqual({
      content: content.trim(),
      language,
    });
    expect(composer()).toHaveValue("");
  });
  it("pending message prevents duplicate submit and disables input", async () => {
    const pending = deferred<unknown>();
    const net = await ai({
      [`POST ${prefix}/7/messages`]: () => pending.promise,
    });
    change(composer(), "Hello");
    submit(composer());
    expect(composer()).toBeDisabled();
    submit(composer());
    expect(net.mutations()).toHaveLength(1);
    pending.resolve([]);
    await waitFor(() => expect(composer()).toBeEnabled());
  });
  it.each([401, 403, 500])(
    "message failure %i routes auth or assistant notice",
    async (status) => {
      const net = await ai({
        [`POST ${prefix}/7/messages`]: response({ message: "failure" }, status),
      });
      change(composer(), "Hello");
      submit(composer());
      if (status < 500)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          t.assistantUnavailable,
        );
      await waitFor(() => expect(composer()).toBeEnabled());
    },
  );
  it.each(["", " \t "])("rename blank %j is blocked", async (title) => {
    const net = await ai({}, "es", false);
    fireEvent.click(button("rename"));
    change(field("title"), title);
    submit(field("title"));
    expect(net.mutations()).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("rename trims and updates active conversation", async () => {
    const net = await ai({
      [`PATCH ${prefix}/7`]: { ...conversation, title: "Updated" },
    });
    fireEvent.click(button("rename"));
    change(field("title"), " Updated ");
    submit(field("title"));
    await screen.findByRole("heading", { name: "Updated" });
    expect(net.mutations()[0].body).toEqual({ title: "Updated" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("rename cancel makes no mutation", async () => {
    const net = await ai({}, "es", false);
    fireEvent.click(button("rename"));
    change(field("title"), "Draft");
    fireEvent.click(button("cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it.each([401, 403, 500])(
    "rename failure %i keeps dialog and routes authorization",
    async (status) => {
      const net = await ai({
        [`PATCH ${prefix}/7`]: response({ message: "failure" }, status),
      });
      fireEvent.click(button("rename"));
      change(field("title"), "Updated");
      submit(field("title"));
      if (status < 500)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );
  it("delete requires confirmation; cancellation retains conversation", async () => {
    const net = await ai();
    fireEvent.click(button("delete"));
    expect(net.mutations()).toHaveLength(0);
    fireEvent.click(button("cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it("confirmed deletion clears active messages and returns to history", async () => {
    const net = await ai({ [`DELETE ${prefix}/7`]: response(null, 204) });
    fireEvent.click(button("delete"));
    fireEvent.click(screen.getAllByRole("button", { name: t.delete }).at(-1)!);
    await screen.findByText(t.noConversations);
    expect(screen.queryByPlaceholderText(t.messagePlaceholder)).toBeNull();
    expect(net.mutations()[0]).toMatchObject({
      path: `${prefix}/7`,
      method: "DELETE",
    });
  });
  it.each([401, 500])(
    "delete failure %i preserves conversation",
    async (status) => {
      const net = await ai({
        [`DELETE ${prefix}/7`]: response({ message: "failure" }, status),
      });
      fireEvent.click(button("delete"));
      fireEvent.click(
        screen.getAllByRole("button", { name: t.delete }).at(-1)!,
      );
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(
        screen.getByRole("heading", { name: conversation.title }),
      ).toBeInTheDocument();
    },
  );
  it("new conversation uses server ID for subsequent message", async () => {
    const net = await ai(
      {
        [`POST ${prefix}`]: { id: 9, title: "New" },
        [`POST ${prefix}/9/messages`]: [],
      },
      "es",
      false,
    );
    fireEvent.click(button("newConversation"));
    await screen.findByRole("heading", { name: "New" });
    change(composer(), "Hello");
    submit(composer());
    await waitFor(() => expect(net.mutations()).toHaveLength(2));
    expect(net.mutations()[1].path).toBe(`${prefix}/9/messages`);
  });
  it.each([401, 500])(
    "conversation list failure %i routes error without opening a chat",
    async (status) => {
      network({ [`GET ${prefix}`]: response({ message: "failure" }, status) });
      const onUnauthorized = vi.fn();
      mount(
        <EmployeeAiPage
          token={token}
          language="es"
          onUnauthorized={onUnauthorized}
        />,
      );
      if (status === 401)
        await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.queryByPlaceholderText(t.messagePlaceholder)).toBeNull();
    },
  );
  it.each([401, 500])(
    "conversation creation failure %i leaves history intact",
    async (status) => {
      const net = await ai(
        { [`POST ${prefix}`]: response({ message: "failure" }, status) },
        "es",
        false,
      );
      fireEvent.click(button("newConversation"));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(
        screen.getByRole("button", { name: conversation.title }),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(t.messagePlaceholder)).toBeNull();
    },
  );
  it.each([401, 500])(
    "message history failure %i routes error",
    async (status) => {
      const net = await ai({
        [`GET ${prefix}/7/messages`]: response({ message: "failure" }, status),
      });
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.queryByText("Local answer")).toBeNull();
    },
  );
});
