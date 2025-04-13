import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  type UIMessage,
} from "ai";

import { generateTitleFromUserMessageAction } from "@/app/api/chat/actions";
import { customModelProvider, isReasoningModel } from "lib/ai/models";

import { getMockUserSession } from "lib/mock";
import { mcpClientsManager } from "../mcp/mcp-manager";

import { chatService } from "lib/db/chat-service";
import logger from "logger";
import { SYSTEM_TIME_PROMPT } from "lib/ai/prompts";

const { insertMessage, insertThread, selectThread } = chatService;

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const {
      id,
      messages,
      model: modelName,
      mode,
    } = json as {
      id?: string;
      messages: Array<UIMessage>;
      model: string;
      mode?: "update-assistant" | "";
    };

    let thread = id ? await selectThread(id) : null;

    const userId = getMockUserSession().id;

    const message = messages
      .filter((message) => message.role === "user")
      .at(-1);

    if (!message) {
      return new Response("No user message found", { status: 400 });
    }

    if (!thread) {
      const title = await generateTitleFromUserMessageAction({
        message,
        model: customModelProvider.getModel(modelName),
      });

      thread = await insertThread({
        title,
        id,
        userId,
      });
    }

    const tools = mcpClientsManager.tools();
    const model = customModelProvider.getModel(modelName);

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model,
          system: SYSTEM_TIME_PROMPT,
          messages,
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: isReasoningModel(model) ? undefined : tools,
          maxSteps: 5,
          onFinish: async ({ response }) => {
            const [, assistantMessage] = appendResponseMessages({
              messages: [message],
              responseMessages: response.messages,
            });
            if (mode !== "update-assistant") {
              await insertMessage({
                threadId: thread.id,
                model: null,
                role: "user",
                parts: message.parts,
                attachments: [],
                id: message.id,
              });
            }

            await insertMessage({
              model: modelName,
              threadId: thread.id,
              role: "assistant",
              id: assistantMessage.id,
              parts: assistantMessage.parts as UIMessage["parts"],
              attachments: [],
            });
          },
        });
        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error: any) => {
        logger.error(error);
        return JSON.stringify(error) || "Oops, an error occured!";
      },
    });
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message || "Oops, an error occured!", {
      status: 500,
    });
  }
}
