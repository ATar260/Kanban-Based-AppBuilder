"use client";

import * as React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "framer-motion";

import GenerationComposer, { type GenerationComposerMode } from "@/components/app/generation/GenerationComposer";
import BrandGuidelinesCard from "@/components/app/generation/BrandGuidelinesCard";
import CodeApplicationProgress, { type CodeApplicationState } from "@/components/CodeApplicationProgress";
import type { KanbanTicket } from "@/components/kanban/types";
import type { ConversationContext, GenerationChatMessage, GenerationProgressState } from "@/types/generation";

interface GenerationLeftPanelProps {
  // Composer
  composerMode: GenerationComposerMode;
  setComposerMode: (mode: GenerationComposerMode) => void;
  buildPromptDraft: string;
  setBuildPromptDraft: (value: string) => void;
  cloneUrlDraft: string;
  setCloneUrlDraft: (value: string) => void;
  editDraft: string;
  setEditDraft: (value: string) => void;
  onSubmitComposer: (mode: GenerationComposerMode) => void | Promise<void>;
  composerDisabled: boolean;

  // Build status (source of truth: Kanban)
  isPlanning: boolean;
  isBuilding: boolean;
  tickets: KanbanTicket[];
  onOpenKanban: () => void;
  onStartBuild: () => void;

  // Conversation + scraping context
  conversationContext: ConversationContext;
  screenshotCollapsed: boolean;
  onToggleScreenshotCollapsed: () => void;

  // Activity feed
  chatMessages: GenerationChatMessage[];
  chatMessagesRef: React.RefObject<HTMLDivElement | null>;
  generationProgress: GenerationProgressState;
  codeApplicationState: CodeApplicationState;
}

export default function GenerationLeftPanel({
  composerMode,
  setComposerMode,
  buildPromptDraft,
  setBuildPromptDraft,
  cloneUrlDraft,
  setCloneUrlDraft,
  editDraft,
  setEditDraft,
  onSubmitComposer,
  composerDisabled,
  isPlanning,
  isBuilding,
  tickets,
  onOpenKanban,
  onStartBuild,
  conversationContext,
  screenshotCollapsed,
  onToggleScreenshotCollapsed,
  chatMessages,
  chatMessagesRef,
  generationProgress,
  codeApplicationState,
}: GenerationLeftPanelProps) {
  const hasBacklog = tickets.some((t) => t.status === "backlog");
  const hasFailed = tickets.some((t) => t.status === "failed");
  const doneCount = tickets.filter((t) => t.status === "done").length;
  const totalCount = tickets.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="w-[320px] flex-none flex flex-col border-r border-border bg-white">
      <div className="p-4 border-b border-border bg-white">
        <GenerationComposer
          mode={composerMode}
          onModeChange={setComposerMode}
          buildValue={buildPromptDraft}
          cloneValue={cloneUrlDraft}
          editValue={editDraft}
          onValueChange={(mode, value) => {
            if (mode === "build") setBuildPromptDraft(value);
            else if (mode === "clone") setCloneUrlDraft(value);
            else setEditDraft(value);
          }}
          onSubmit={onSubmitComposer}
          disabled={composerDisabled}
        />
      </div>

      {/* Suggested follow-up actions (only when in Edit mode) */}
      {!generationProgress.isGenerating &&
        generationProgress.files.length > 0 &&
        composerMode === "edit" &&
        !editDraft && (
          <div className="px-4 py-2 border-b border-border bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Add dark mode", prompt: "Add a dark mode toggle and apply dark theme styles" },
                { label: "Improve animations", prompt: "Add smooth animations and hover effects to all interactive elements" },
                { label: "Make responsive", prompt: "Ensure the layout is fully responsive for mobile, tablet, and desktop" },
                { label: "Add more sections", prompt: "Add more content sections like testimonials, FAQ, and contact form" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setComposerMode("edit");
                    setEditDraft(action.prompt);
                  }}
                  className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-full transition-all"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Compact build status (single source of truth: Kanban) */}
      {(isPlanning || totalCount > 0) && (
        <div className="px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPlanning ? (
                <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              ) : isBuilding ? (
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              ) : hasFailed ? (
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              ) : (
                <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
              )}
              <div className="text-xs font-semibold text-gray-800">
                {isPlanning ? "Planning…" : isBuilding ? "Building…" : "Build plan"}
              </div>
            </div>

            <button
              onClick={onOpenKanban}
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
              type="button"
            >
              Open
            </button>
          </div>

          {totalCount > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  {doneCount}/{totalCount} done
                </span>
                <span>{percent}%</span>
              </div>
              <div className="mt-1.5 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${(doneCount / Math.max(1, totalCount)) * 100}%` }}
                />
              </div>

              {!isPlanning && !isBuilding && hasBacklog && (
                <div className="mt-2 flex">
                  <button
                    type="button"
                    onClick={onStartBuild}
                    className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  >
                    Start build
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {conversationContext.scrapedWebsites.length > 0 && (
        <div className="p-4 bg-card border-b border-gray-200">
          <div className="flex flex-col gap-4">
            {conversationContext.scrapedWebsites.map((site, idx) => {
              const metadata = site.content?.metadata || {};
              const sourceURL = metadata.sourceURL || site.url;
              const favicon =
                metadata.favicon ||
                `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
              const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;
              const screenshot = site.content?.screenshot || sessionStorage.getItem("websiteScreenshot");

              return (
                <div key={idx} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={favicon}
                      alt={siteName}
                      className="w-8 h-8 rounded"
                      onError={(e) => {
                        e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                      }}
                    />
                    <a
                      href={sourceURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black hover:text-gray-700 truncate max-w-[250px] font-medium"
                      title={sourceURL}
                    >
                      {siteName}
                    </a>
                  </div>

                  {screenshot && (
                    <div className="w-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Screenshot Preview</span>
                        <button
                          onClick={onToggleScreenshotCollapsed}
                          className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                          aria-label={screenshotCollapsed ? "Expand screenshot" : "Collapse screenshot"}
                          type="button"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className={`transition-transform duration-300 ${screenshotCollapsed ? "rotate-180" : ""}`}
                          >
                            <path
                              d="M4 6L8 10L12 6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div
                        className="w-full rounded-lg overflow-hidden border border-gray-200 transition-all duration-300"
                        style={{
                          opacity: screenshotCollapsed ? 0 : 1,
                          transform: screenshotCollapsed ? "translateY(-20px)" : "translateY(0)",
                          pointerEvents: screenshotCollapsed ? "none" : "auto",
                          maxHeight: screenshotCollapsed ? "0" : "200px",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshot}
                          alt={`${siteName} preview`}
                          className="w-full h-auto object-cover"
                          style={{ maxHeight: "200px" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide bg-gray-50"
        ref={chatMessagesRef}
      >
        {chatMessages.map((msg, idx) => {
          const isGenerationComplete =
            msg.content.includes("Successfully recreated") ||
            msg.content.includes("AI recreation generated!") ||
            msg.content.includes("Code generated!");

          return (
            <div key={idx} className="block">
              <div className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className="block">
                  <div
                    className={`block rounded-lg px-3 py-2 ${
                      msg.type === "user"
                        ? "bg-[#36322F] text-white ml-auto max-w-[80%]"
                        : msg.type === "ai"
                          ? "bg-gray-100 text-gray-900 mr-auto max-w-[80%]"
                          : msg.type === "system"
                            ? "bg-[#36322F] text-white text-sm"
                            : msg.type === "command"
                              ? "bg-[#36322F] text-white font-mono text-sm"
                              : msg.type === "error"
                                ? "bg-red-900 text-red-100 text-sm border border-red-700"
                                : "bg-[#36322F] text-white text-sm"
                    }`}
                  >
                    {msg.type === "command" ? (
                      <div className="flex items-start gap-2">
                        <span
                          className={`text-xs ${
                            msg.metadata?.commandType === "input"
                              ? "text-blue-400"
                              : msg.metadata?.commandType === "error"
                                ? "text-red-400"
                                : msg.metadata?.commandType === "success"
                                  ? "text-green-400"
                                  : "text-gray-400"
                          }`}
                        >
                          {msg.metadata?.commandType === "input" ? "$" : ">"}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                      </div>
                    ) : msg.type === "error" ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Build Errors Detected</div>
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                          <div className="mt-2 text-xs opacity-70">Press 'F' or click the Fix button above to resolve</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm">{msg.content}</span>
                    )}
                  </div>

                  {msg.metadata?.brandingData && (
                    <BrandGuidelinesCard
                      brandingData={msg.metadata.brandingData}
                      sourceUrl={msg.metadata.sourceUrl}
                    />
                  )}

                  {/* Applied files pills */}
                  {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                    <div className="mt-3 inline-block bg-gray-100 rounded-lg p-3">
                      <div className="text-sm font-medium mb-3 text-gray-700">
                        {msg.content.includes("Applied") ? "Files Updated:" : "Generated Files:"}
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {msg.metadata.appliedFiles.map((filePath, fileIdx) => {
                          const fileName = filePath.split("/").pop() || filePath;
                          const fileExt = fileName.split(".").pop() || "";
                          const fileType =
                            fileExt === "jsx" || fileExt === "js"
                              ? "javascript"
                              : fileExt === "css"
                                ? "css"
                                : fileExt === "json"
                                  ? "json"
                                  : "text";

                          return (
                            <div
                              key={`applied-${fileIdx}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-sm animate-fade-in-up"
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            >
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  fileType === "css"
                                    ? "bg-blue-400"
                                    : fileType === "javascript"
                                      ? "bg-yellow-400"
                                      : fileType === "json"
                                        ? "bg-green-400"
                                        : "bg-gray-400"
                                }`}
                              />
                              {fileName}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Generated files fallback for completion message */}
                  {isGenerationComplete &&
                    generationProgress.files.length > 0 &&
                    idx === chatMessages.length - 1 &&
                    !msg.metadata?.appliedFiles &&
                    !chatMessages.some((m) => m.metadata?.appliedFiles) && (
                      <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                        <div className="text-xs font-medium mb-1 text-gray-700">Generated Files:</div>
                        <div className="flex flex-wrap items-start gap-1">
                          {generationProgress.files.map((file, fileIdx) => (
                            <div
                              key={`complete-${fileIdx}`}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-xs animate-fade-in-up"
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            >
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  file.type === "css"
                                    ? "bg-blue-400"
                                    : file.type === "javascript"
                                      ? "bg-yellow-400"
                                      : file.type === "json"
                                        ? "bg-green-400"
                                        : "bg-gray-400"
                                }`}
                              />
                              {file.path.split("/").pop()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })}

        {codeApplicationState.stage && <CodeApplicationProgress state={codeApplicationState} />}

        {generationProgress.isGenerating && (
          <div className="inline-block bg-gray-100 rounded-lg p-3">
            <div className="text-sm font-medium mb-2 text-gray-700">{generationProgress.status}</div>
            <div className="flex flex-wrap items-start gap-1">
              {generationProgress.files.map((file, idx) => (
                <div
                  key={`file-${idx}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-xs animate-fade-in-up"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {file.path.split("/").pop()}
                </div>
              ))}

              {generationProgress.currentFile && (
                <div
                  className="flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-sm animate-pulse"
                  style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}
                >
                  <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {generationProgress.currentFile.path.split("/").pop()}
                </div>
              )}
            </div>

            {generationProgress.streamedCode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 border-t border-gray-300 pt-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-gray-600">AI Response Stream</span>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                </div>
                <div className="bg-gray-900 border border-gray-700 rounded max-h-128 overflow-y-auto scrollbar-hide">
                  <SyntaxHighlighter
                    language="jsx"
                    style={vscDarkPlus}
                    customStyle={{
                      margin: 0,
                      padding: "0.75rem",
                      fontSize: "11px",
                      lineHeight: "1.5",
                      background: "transparent",
                      maxHeight: "8rem",
                      overflow: "hidden",
                    }}
                  >
                    {(() => {
                      const lastContent = generationProgress.streamedCode.slice(-1000);
                      const startIndex = lastContent.indexOf("<");
                      return startIndex !== -1 ? lastContent.slice(startIndex) : lastContent;
                    })()}
                  </SyntaxHighlighter>
                  <span className="inline-block w-3 h-4 bg-orange-400 ml-3 mb-3 animate-pulse" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


