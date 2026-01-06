"use client";

import { useState } from "react";
import Link from "next/link";
import { appConfig } from "@/config/app.config";

interface SidebarInputProps {
  onSubmit: (url: string, style: string, model: string, instructions?: string) => void;
  onPromptSubmit?: (prompt: string, model: string) => void;
  onImportSubmit?: (
    repoFullName: string,
    branch: string,
    maxFiles: number,
    model: string,
    goalPrompt?: string
  ) => void;
  disabled?: boolean;
}

const SUGGESTED_BUILDS = [
  {
    id: "landing",
    name: "Landing Page",
    description: "Modern SaaS landing page with hero, features, and CTA",
    prompt: "Create a modern SaaS landing page with a hero section featuring a headline, subheadline, and CTA button. Include a features grid with icons, a testimonials section, pricing cards, and a footer with links.",
    icon: "🚀",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Admin dashboard with charts and data tables",
    prompt: "Build an admin dashboard with a sidebar navigation, top header with user profile, stats cards showing KPIs, a line chart for trends, a bar chart for comparisons, and a data table with pagination.",
    icon: "📊",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Product listing with cart and checkout",
    prompt: "Create an e-commerce product page with a product grid, filters sidebar, product cards with images and prices, a shopping cart drawer, and a checkout form with payment fields.",
    icon: "🛒",
  },
  {
    id: "blog",
    name: "Blog",
    description: "Blog with posts, categories, and comments",
    prompt: "Build a blog homepage with featured post hero, post grid with thumbnails and excerpts, category sidebar, newsletter signup, and a single post view with author info and comments section.",
    icon: "📝",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Personal portfolio with projects showcase",
    prompt: "Create a personal portfolio site with an about section, skills list with progress bars, project gallery with modal previews, work experience timeline, and contact form.",
    icon: "💼",
  },
  {
    id: "saas-pricing",
    name: "Pricing Page",
    description: "SaaS pricing with feature comparison",
    prompt: "Build a pricing page with 3 pricing tiers (Basic, Pro, Enterprise), monthly/yearly toggle, feature comparison table, FAQ accordion, and a CTA section.",
    icon: "💰",
  },
];

const CLONE_EXAMPLES = [
  { name: "Stripe", url: "stripe.com", icon: "💳" },
  { name: "Linear", url: "linear.app", icon: "📐" },
  { name: "Vercel", url: "vercel.com", icon: "▲" },
  { name: "Notion", url: "notion.so", icon: "📓" },
  { name: "Figma", url: "figma.com", icon: "🎨" },
  { name: "GitHub", url: "github.com", icon: "🐙" },
];

export default function SidebarInput({ onSubmit, onPromptSubmit, onImportSubmit, disabled = false }: SidebarInputProps) {
  const [activeTab, setActiveTab] = useState<"build" | "clone" | "import">("build");
  const [url, setUrl] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("4");
  const [selectedModel, setSelectedModel] = useState<string>(appConfig.ai.defaultModel);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>("");
  const [showCloneOptions, setShowCloneOptions] = useState<boolean>(false);
  const [repoFullName, setRepoFullName] = useState<string>("");
  const [repoBranch, setRepoBranch] = useState<string>("main");
  const [maxFiles, setMaxFiles] = useState<number>(100);
  const [importGoal, setImportGoal] = useState<string>("");

  const styles = [
    { id: "1", name: "Glassmorphism" },
    { id: "2", name: "Neumorphism" },
    { id: "3", name: "Brutalism" },
    { id: "4", name: "Minimalist" },
    { id: "5", name: "Dark Mode" },
    { id: "6", name: "Gradient Rich" },
  ];

  const models = appConfig.ai.availableModels.map(model => ({
    id: model,
    name: appConfig.ai.modelDisplayNames[model] || model,
  }));

  const handleCloneSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || disabled) return;
    onSubmit(url.trim(), selectedStyle, selectedModel, additionalInstructions || undefined);
    setUrl("");
    setAdditionalInstructions("");
    setShowCloneOptions(false);
  };

  const handleBuildSubmit = (prompt: string) => {
    if (disabled) return;
    if (onPromptSubmit) {
      onPromptSubmit(prompt, selectedModel);
    } else {
      sessionStorage.setItem('buildFromPrompt', 'true');
      sessionStorage.setItem('buildPrompt', prompt);
      sessionStorage.setItem('selectedModel', selectedModel);
      window.location.reload();
    }
  };

  const handleCustomPromptSubmit = () => {
    if (!customPrompt.trim() || disabled) return;
    handleBuildSubmit(customPrompt.trim());
    setCustomPrompt("");
  };

  const validateUrl = (urlString: string): boolean => {
    if (!urlString) return false;
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    return urlPattern.test(urlString.toLowerCase());
  };

  const normalizeRepoFullName = (raw: string): string => {
    let v = raw.trim();
    v = v.replace(/^https?:\/\/github\.com\//i, "");
    v = v.replace(/^github\.com\//i, "");
    v = v.replace(/\.git$/i, "");
    return v;
  };

  const isValidRepoFullName = (raw: string): boolean => {
    const v = normalizeRepoFullName(raw);
    const parts = v.split("/");
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  };

  const handleImportSubmit = () => {
    if (disabled) return;
    if (!isValidRepoFullName(repoFullName)) return;
    const cleaned = normalizeRepoFullName(repoFullName);
    const branch = repoBranch.trim() || "main";
    const goal = importGoal.trim() || undefined;
    const cappedMaxFiles = Math.max(10, Math.min(300, Math.floor(maxFiles)));
    onImportSubmit?.(cleaned, branch, cappedMaxFiles, selectedModel, goal);
  };

  return (
    <div className="w-full">
      <div className="border-b border-gray-100">
        <Link href="/">
          <button className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-white rounded border border-gray-200 hover:border-gray-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors">
            ← Back to Home
          </button>
        </Link>
      </div>

      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab("build")}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === "build"
              ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🔨 Build
        </button>
        <button
          onClick={() => setActiveTab("clone")}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === "clone"
              ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Clone
        </button>
        <button
          onClick={() => setActiveTab("import")}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === "import"
              ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🐙 Import
        </button>
      </div>

      {activeTab === "build" && (
        <div className="p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Suggested Templates</label>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {SUGGESTED_BUILDS.map((build) => (
                <button
                  key={build.id}
                  onClick={() => handleBuildSubmit(build.prompt)}
                  disabled={disabled}
                  className="w-full p-2.5 text-left rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base">{build.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 group-hover:text-orange-700">
                        {build.name}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {build.description}
                      </div>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Or describe your own</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={disabled}
              placeholder="Describe what you want to build..."
              className="w-full px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCustomPromptSubmit();
                }
              }}
            />
            <button
              onClick={handleCustomPromptSubmit}
              disabled={!customPrompt.trim() || disabled}
              className={`w-full mt-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                customPrompt.trim() && !disabled
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {disabled ? "Planning..." : "Start Building"}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 text-xs text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === "clone" && (
        <div className="p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Enter URL to clone</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setShowCloneOptions(validateUrl(e.target.value));
                }}
                disabled={disabled}
                placeholder="https://example.com"
                className="flex-1 px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCloneSubmit();
                  }
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Quick Clone</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CLONE_EXAMPLES.map((example) => (
                <button
                  key={example.url}
                  onClick={() => {
                    setUrl(example.url);
                    setShowCloneOptions(true);
                  }}
                  disabled={disabled}
                  className="p-2 text-center rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-all disabled:opacity-50"
                >
                  <span className="text-base block">{example.icon}</span>
                  <span className="text-[10px] text-gray-600">{example.name}</span>
                </button>
              ))}
            </div>
          </div>

          {showCloneOptions && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Style</label>
                <div className="grid grid-cols-2 gap-1">
                  {styles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      disabled={disabled}
                      className={`py-1.5 px-2 rounded text-[10px] font-medium border transition-all ${
                        selectedStyle === style.id
                          ? "border-orange-500 bg-orange-50 text-orange-900"
                          : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">AI Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={disabled}
                  className="w-full px-2.5 py-1.5 text-xs text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Instructions (optional)</label>
                <input
                  type="text"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  disabled={disabled}
                  className="w-full px-2.5 py-1.5 text-xs text-gray-700 bg-gray-50 rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400"
                  placeholder="e.g., make it more colorful..."
                />
              </div>

              <button
                onClick={handleCloneSubmit}
                disabled={!url.trim() || disabled}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  url.trim() && !disabled
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {disabled ? "Planning..." : "Clone Website"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "import" && (
        <div className="p-3 space-y-3">
          <div className="text-[11px] text-gray-500">
            Import an existing repo for brownfield planning. Make sure you're logged in with GitHub (top bar).
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Repository</label>
            <input
              type="text"
              value={repoFullName}
              onChange={(e) => setRepoFullName(e.target.value)}
              disabled={disabled}
              placeholder="owner/repo (or https://github.com/owner/repo)"
              className="w-full px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400"
            />
            {!disabled && repoFullName.trim().length > 0 && !isValidRepoFullName(repoFullName) && (
              <div className="mt-1 text-[10px] text-red-600">Enter a valid GitHub repo like “owner/repo”.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Branch</label>
              <input
                type="text"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                disabled={disabled}
                placeholder="main"
                className="w-full px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Max files</label>
              <input
                type="number"
                min={10}
                max={300}
                value={maxFiles}
                onChange={(e) => setMaxFiles(Number(e.target.value))}
                disabled={disabled}
                className="w-full px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">What do you want to change? (optional)</label>
            <textarea
              value={importGoal}
              onChange={(e) => setImportGoal(e.target.value)}
              disabled={disabled}
              placeholder="e.g., Add a billing page, modernize the UI, fix navigation…"
              className="w-full px-2.5 py-2 text-xs text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-400 resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleImportSubmit();
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={disabled}
              className="w-full px-2.5 py-1.5 text-xs text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleImportSubmit}
            disabled={disabled || !isValidRepoFullName(repoFullName)}
            className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              !disabled && isValidRepoFullName(repoFullName)
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {disabled ? "Importing..." : "Import & Create plan"}
          </button>
        </div>
      )}
    </div>
  );
}
