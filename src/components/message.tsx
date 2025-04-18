"use client";

import type { UIMessage } from "ai";
import { memo, useEffect, useMemo, useState } from "react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "lib/utils";
import type { UseChatHelpers } from "@ai-sdk/react";
import { Alert, AlertDescription, AlertTitle } from "ui/alert";
import {
  UserMessagePart,
  AssistMessagePart,
  ToolMessagePart,
  ReasoningPart,
} from "./message-parts";

interface Props {
  message: UIMessage;
  threadId: string;
  isLoading: boolean;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  className?: string;
}

const PurePreviewMessage = ({
  message,
  threadId,
  setMessages,
  reload,
  className,
}: Props) => {
  const isUserMessage = useMemo(() => message.role === "user", [message.role]);
  return (
    <AnimatePresence>
      <motion.div
        className="ease-in-out w-full mx-auto max-w-3xl px-6 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div
          className={cn(
            className,
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
          )}
        >
          <div className="flex flex-col gap-4 w-full">
            {message.experimental_attachments && (
              <div
                data-testid={"message-attachments"}
                className="flex flex-row justify-end gap-2"
              >
                {message.experimental_attachments.map((attachment) => (
                  <Alert key={attachment.url}>
                    <AlertTitle>Attachment</AlertTitle>
                    <AlertDescription>
                      attachment not yet implemented 😁
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {message.parts?.map((part, index) => {
              const key = `message-${message.id}-part-${index}`;

              if (part.type === "reasoning") {
                return <ReasoningPart key={key} reasoning={part.reasoning} />;
              }

              if (part.type === "text" && isUserMessage) {
                return (
                  <UserMessagePart
                    key={key}
                    part={part}
                    isLast={index === message.parts.length - 1}
                    message={message}
                    setMessages={setMessages}
                    reload={reload}
                  />
                );
              }

              if (part.type === "text" && !isUserMessage) {
                return (
                  <AssistMessagePart
                    threadId={threadId}
                    key={key}
                    part={part}
                    isLast={index === message.parts.length - 1}
                    message={message}
                    setMessages={setMessages}
                    reload={reload}
                  />
                );
              }

              if (part.type === "tool-invocation") {
                return <ToolMessagePart key={key} part={part} />;
              }
              return null;
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.className !== nextProps.className) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    return true;
  },
);

export const ThinkingMessage = ({ className }: { className?: string }) => {
  const role = "assistant";
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <motion.div
      data-testid="message-assistant-loading"
      className={cn("w-full mx-auto max-w-3xl px-4 group/message", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-col gap-4 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex space-x-2">
              <motion.div
                className="h-2 w-2 rounded-full bg-primary"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
