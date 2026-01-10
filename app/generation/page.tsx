'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { appConfig } from '@/config/app.config';
import HeroInput from '@/components/HeroInput';
import SidebarInput from '@/components/app/generation/SidebarInput';
import HeaderBrandKit from '@/components/shared/header/BrandKit/BrandKit';
import { HeaderProvider } from '@/components/shared/header/HeaderContext';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  FiFile,
  FiChevronRight,
  FiChevronDown,
  FiGithub,
  BsFolderFill,
  BsFolder2Open,
  SiJavascript,
  SiReact,
  SiCss3,
  SiJson
} from '@/lib/icons';
import { motion } from 'framer-motion';
import CodeApplicationProgress, { type CodeApplicationState } from '@/components/CodeApplicationProgress';
import { KanbanBoard, useKanbanBoard, BuildPlan, TicketStatus } from '@/components/kanban';
import type { KanbanTicket as KanbanTicketType } from '@/components/kanban/types';
import { useVersioning } from '@/hooks/useVersioning';
import { GitHubConnectButton, VersionHistoryPanel, SaveStatusIndicator, GitSyncToggle } from '@/components/versioning';
import { saveGitHubConnection } from '@/lib/versioning/github';
import { DeployPanel } from '@/components/deploy';
import { useBuildTracker } from '@/hooks/useBuildTracker';
import { useGitSync } from '@/hooks/useGitSync';
import { UserMenu, LoginButton } from '@/components/auth';
import { UsagePill } from '@/components/usage/UsagePill';
import UIOptionsSelector, { UIOption } from '@/components/ui-options/UIOptionsSelector';
import { useBugbot, ReviewResult } from '@/hooks/useBugbot';
import { CodeReviewPanel, RegressionWarningModal } from '@/components/kanban';
import { useSoftDelete } from '@/hooks/useSoftDelete';
import { useAutoRefactor } from '@/hooks/useAutoRefactor';
import { useGitHubImport } from '@/hooks/useGitHubImport';
import { usePlanVersions, type PlanVersion } from '@/hooks/usePlanVersions';
import { PlanVersionHistoryPanel } from '@/components/planning';

interface SandboxData {
  sandboxId: string;
  url: string;
  [key: string]: any;
}

interface ChatMessage {
  content: string;
  type: 'user' | 'ai' | 'system' | 'file-update' | 'command' | 'error';
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    scrapedContent?: any;
    generatedCode?: string;
    appliedFiles?: string[];
    commandType?: 'input' | 'output' | 'error' | 'success';
    brandingData?: any;
    sourceUrl?: string;
  };
}

interface ScrapeData {
  success: boolean;
  content?: string;
  url?: string;
  title?: string;
  source?: string;
  screenshot?: string;
  structured?: any;
  metadata?: any;
  message?: string;
  error?: string;
}

function AISandboxPage() {
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiEnabled] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('project');
  const [aiModel, setAiModel] = useState(() => {
    const modelParam = searchParams.get('model');
    return appConfig.ai.availableModels.includes(modelParam || '') ? modelParam! : appConfig.ai.defaultModel;
  });
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState<string[]>([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'src', 'src/components']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'generation' | 'preview' | 'kanban' | 'split'>('kanban');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  const [isScreenshotLoaded, setIsScreenshotLoaded] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [sidebarScrolled, setSidebarScrolled] = useState(false);
  const [screenshotCollapsed, setScreenshotCollapsed] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'gathering' | 'planning' | 'generating' | null>(null);
  const [isStartingNewGeneration, setIsStartingNewGeneration] = useState(false);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string>>({});
  const [hasInitialSubmission, setHasInitialSubmission] = useState<boolean>(false);

  // UI/UX improvements state
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [sandboxRetryCount, setSandboxRetryCount] = useState(0);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [fileStructure, setFileStructure] = useState<string>('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [kanbanBuildActive, setKanbanBuildActive] = useState(false);
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
  const [sandboxExpired, setSandboxExpired] = useState(false);
  const [isRestoringSandbox, setIsRestoringSandbox] = useState(false);

  // UI Options state for 3-mockup generation
  const [showUIOptions, setShowUIOptions] = useState(false);
  const [uiOptions, setUIOptions] = useState<UIOption[]>([]);
  const [isLoadingUIOptions, setIsLoadingUIOptions] = useState(false);
  const [isImportingRepo, setIsImportingRepo] = useState(false);
  const [lastImportedRepo, setLastImportedRepo] = useState<{ repoFullName: string; branch: string } | null>(null);
  const [isLoadingRepoIntoSandbox, setIsLoadingRepoIntoSandbox] = useState(false);
  const [repoLoadModalOpen, setRepoLoadModalOpen] = useState(false);
  const [repoLoadStatus, setRepoLoadStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [repoLoadError, setRepoLoadError] = useState<string | null>(null);
  const [repoLoadSteps, setRepoLoadSteps] = useState<
    Array<{ id: string; label: string; status: 'pending' | 'running' | 'done' | 'error'; detail?: string }>
  >([]);
  const [repoLoadLogs, setRepoLoadLogs] = useState<string[]>([]);
  const [selectedUIOption, setSelectedUIOption] = useState<UIOption | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');

  // Bugbot code review state
  const [showCodeReview, setShowCodeReview] = useState(false);
  const [pendingReviewData, setPendingReviewData] = useState<{
    tickets: KanbanTicketType[];
    fileContents: Array<{ path: string; content: string }>;
  } | null>(null);
  const [resumeAfterReview, setResumeAfterReview] = useState(false);

  const kanban = useKanbanBoard();
  const bugbot = useBugbot();
  const softDelete = useSoftDelete();
  const autoRefactor = useAutoRefactor();
  const githubImport = useGitHubImport();

  // Regression warning state
  const [regressionWarning, setRegressionWarning] = useState<{
    isOpen: boolean;
    ticketId: string;
    ticketTitle: string;
    fromColumn: string;
    toColumn: string;
    newStatus: TicketStatus;
  } | null>(null);

  // Build Tracker Agent - monitors generation and updates Kanban tickets
  const buildTracker = useBuildTracker({
    onTicketCreate: kanban.addTicket,
    onTicketUpdate: kanban.editTicket,
    onTicketStatusChange: kanban.updateTicketStatus,
    onProgressUpdate: kanban.updateTicketProgress
  });

  const versioning = useVersioning({ enableAutoSave: true, autoSaveInterval: 5 * 60 * 1000 });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [versionHistoryTab, setVersionHistoryTab] = useState<'plan' | 'code'>('plan');

  const planVersions = usePlanVersions({
    planId: kanban.plan?.id || 'active',
    projectId,
  });

  // Git Sync hook for auto-committing on ticket completion
  const gitSync = useGitSync({
    onSyncComplete: (result) => {
      addChatMessage(`✅ Auto-synced to GitHub: ${result.commitSha.slice(0, 7)}`, 'system');
    },
    onSyncError: (error, ticketId) => {
      console.error(`[GitSync] Failed to sync ticket ${ticketId}:`, error);
    },
  });

  const [conversationContext, setConversationContext] = useState<{
    scrapedWebsites: Array<{ url: string; content: any; timestamp: Date }>;
    generatedComponents: Array<{ name: string; path: string; content: string }>;
    appliedCode: Array<{ files: string[]; timestamp: Date }>;
    currentProject: string;
    lastGeneratedCode?: string;
  }>({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: '',
    lastGeneratedCode: undefined
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  const restoringSandboxRef = useRef(false);

  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({
    stage: null
  });

  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    status: string;
    components: Array<{ name: string; path: string; completed: boolean }>;
    currentComponent: number;
    streamedCode: string;
    isStreaming: boolean;
    isThinking: boolean;
    thinkingText?: string;
    thinkingDuration?: number;
    currentFile?: { path: string; content: string; type: string };
    files: Array<{ path: string; content: string; type: string; completed: boolean; edited?: boolean }>;
    lastProcessedPosition: number;
    isEdit?: boolean;
  }>({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0
  });

  // Store flag to trigger generation after component mounts
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  // Clear old conversation data on component mount and create/restore sandbox
  useEffect(() => {
    let isMounted = true;
    let sandboxCreated = false; // Track if sandbox was created in this effect

    const initializePage = async () => {
      // Prevent double execution in React StrictMode
      if (sandboxCreated) return;

      // First check URL parameters (from home page navigation)
      const urlParam = searchParams.get('url');
      const templateParam = searchParams.get('template');
      const detailsParam = searchParams.get('details');

      // Check for "Build from Prompt" mode
      const buildFromPrompt = sessionStorage.getItem('buildFromPrompt') === 'true';
      const buildPromptText = sessionStorage.getItem('buildPrompt');
      const selectedUIOptionStr = sessionStorage.getItem('selectedUIOption');

      // Then check session storage as fallback
      const storedUrl = urlParam || sessionStorage.getItem('targetUrl');
      const storedStyle = templateParam || sessionStorage.getItem('selectedStyle');
      const storedModel = sessionStorage.getItem('selectedModel');
      const storedInstructions = sessionStorage.getItem('additionalInstructions');

      // Handle "Build from Prompt" mode
      if (buildFromPrompt && buildPromptText) {
        setHasInitialSubmission(true);

        // Parse UI option if selected
        let uiOptionContext = '';
        if (selectedUIOptionStr) {
          try {
            const uiOption = JSON.parse(selectedUIOptionStr);
            uiOptionContext = `\n\nDesign Style: "${uiOption.name}" - ${uiOption.description}
Color Scheme:
- Primary: ${uiOption.colorScheme.primary}
- Secondary: ${uiOption.colorScheme.secondary}
- Accent: ${uiOption.colorScheme.accent}
- Background: ${uiOption.colorScheme.background}
- Text: ${uiOption.colorScheme.text}
Layout: ${uiOption.layout}
Visual Features: ${uiOption.features.join(', ')}`;
          } catch (e) {
            console.error('Failed to parse UI option:', e);
          }
        }

        // Clear sessionStorage
        sessionStorage.removeItem('buildFromPrompt');
        sessionStorage.removeItem('buildPrompt');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('selectedUIOption');

        // Store the prompt for later use (with UI option context if available)
        sessionStorage.setItem('pendingBuildPrompt', buildPromptText + uiOptionContext);

        if (storedModel) {
          setAiModel(storedModel);
        }

        // Skip home screen
        setShowHomeScreen(false);
        setHomeScreenFading(false);

        // Set flag to auto-trigger prompt generation
        setShouldAutoGenerate(true);
        sessionStorage.setItem('autoStart', 'true');
        sessionStorage.setItem('promptMode', 'true');
      } else if (storedUrl) {
        // Mark that we have an initial submission since we're loading with a URL
        setHasInitialSubmission(true);

        // Clear sessionStorage after reading  
        sessionStorage.removeItem('targetUrl');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');
        // Note: Don't clear siteMarkdown here, it will be cleared when used

        // Set the values in the component state
        setHomeUrlInput(storedUrl);
        setSelectedStyle(storedStyle || 'modern');

        // Add details to context if provided
        if (detailsParam) {
          setHomeContextInput(detailsParam);
        } else if (storedStyle && !urlParam) {
          // Only apply stored style if no screenshot URL is provided
          // This prevents unwanted style inheritance when using screenshot search
          const styleNames: Record<string, string> = {
            '1': 'Glassmorphism',
            '2': 'Neumorphism',
            '3': 'Brutalism',
            '4': 'Minimalist',
            '5': 'Dark Mode',
            '6': 'Gradient Rich',
            '7': '3D Depth',
            '8': 'Retro Wave',
            'modern': 'Modern clean and minimalist',
            'playful': 'Fun colorful and playful',
            'professional': 'Corporate professional and sleek',
            'artistic': 'Creative artistic and unique'
          };
          const styleName = styleNames[storedStyle] || storedStyle;
          let contextString = `${styleName} style design`;

          // Add additional instructions if provided
          if (storedInstructions) {
            contextString += `. ${storedInstructions}`;
          }

          setHomeContextInput(contextString);
        } else if (storedInstructions && !urlParam) {
          // Apply only instructions if no style but instructions are provided
          // and no screenshot URL is provided
          setHomeContextInput(storedInstructions);
        }

        if (storedModel) {
          setAiModel(storedModel);
        }

        // Skip the home screen and go directly to builder
        setShowHomeScreen(false);
        setHomeScreenFading(false);

        // Set flag to auto-trigger generation after component updates
        setShouldAutoGenerate(true);

        // Also set autoStart flag for the effect
        sessionStorage.setItem('autoStart', 'true');
      }

      // Clear old conversation
      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' })
        });
        console.log('[home] Cleared old conversation data on mount');
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
        if (isMounted) {
          addChatMessage('Failed to clear old conversation data.', 'error');
        }
      }

      if (!isMounted) return;

      // Check if sandbox ID is in URL
      const sandboxIdParam = searchParams.get('sandbox');

      setLoading(true);
      try {
        // Always create a fresh sandbox - old sandbox IDs in URL are likely expired
        if (sandboxIdParam) {
          console.log('[home] Found sandbox ID in URL, but creating fresh sandbox (old ones expire)');
          // Clear the old sandbox ID from URL
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('sandbox');
          window.history.replaceState({}, '', `/generation?${newParams.toString()}`);
        }
        
        console.log('[home] Creating new sandbox...');
        sandboxCreated = true;
        await createSandbox(true);

        // If we have a URL from the home page, mark for automatic start
        if (storedUrl && isMounted) {
          // We'll trigger the generation after the component is fully mounted
          // and the startGeneration function is defined
          sessionStorage.setItem('autoStart', 'true');
        }
      } catch (error) {
        console.error('[ai-sandbox] Failed to create or restore sandbox:', error);
        if (isMounted) {
          addChatMessage('Failed to create or restore sandbox.', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializePage();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key for home screen
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }

      // Escape to exit fullscreen preview
      if (e.key === 'Escape' && isFullscreenPreview) {
        setIsFullscreenPreview(false);
      }

      // Cmd/Ctrl + K to focus chat input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const chatInput = document.querySelector('textarea[placeholder*="Describe"]') as HTMLTextAreaElement;
        if (chatInput) {
          chatInput.focus();
        }
      }

      // Cmd/Ctrl + Shift + F for fullscreen preview
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        if (sandboxData?.url) {
          setIsFullscreenPreview(!isFullscreenPreview);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen, isFullscreenPreview, sandboxData?.url]);

  // Start capturing screenshot if URL is provided on mount (from home screen)
  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = 'https://' + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to prevent double-triggering of auto-generation (race condition fix)
  const autoGenerationTriggeredRef = useRef<boolean>(false);

  // Track whether we've already applied Supabase env vars for the current sandbox (avoid repeated restarts).
  const supabaseEnvAppliedRef = useRef<string | null>(null);

  // CONSOLIDATED: Single auto-start generation effect to prevent race conditions
  // Previously there were two effects that could both trigger generation
  useEffect(() => {
    // Guard against double execution
    if (autoGenerationTriggeredRef.current) {
      return;
    }

    const autoStart = sessionStorage.getItem('autoStart');
    const promptMode = sessionStorage.getItem('promptMode') === 'true';
    const pendingPrompt = sessionStorage.getItem('pendingBuildPrompt');

    // Only proceed if we have auto-start flag AND home screen is hidden
    if (autoStart !== 'true' || showHomeScreen) {
      return;
    }

    // Mark as triggered to prevent race condition
    autoGenerationTriggeredRef.current = true;

    // Clean up session storage immediately
    sessionStorage.removeItem('autoStart');

    const timer = setTimeout(() => {
      if (promptMode && pendingPrompt) {
        console.log('[generation] Auto-starting generation from prompt');
        sessionStorage.removeItem('promptMode');
        sessionStorage.removeItem('pendingBuildPrompt');
        startPromptGeneration(pendingPrompt);
      } else if (homeUrlInput) {
        console.log('[generation] Auto-starting generation for URL:', homeUrlInput);
        startGeneration();
      } else {
        // Reset the guard if we didn't actually trigger anything
        autoGenerationTriggeredRef.current = false;
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check sandbox status on mount (unless we're auto-starting a new generation)
    const autoStart = sessionStorage.getItem('autoStart');
    if (autoStart !== 'true') {
      checkSandboxStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const githubConnected = searchParams.get('github_connected');
    const githubUsername = searchParams.get('github_username');
    const githubAvatar = searchParams.get('github_avatar');
    const githubToken = searchParams.get('github_token');

    if (githubConnected === 'true' && githubToken && githubUsername) {
      saveGitHubConnection({
        connected: true,
        accessToken: githubToken,
        username: githubUsername,
        avatarUrl: githubAvatar || undefined,
        connectedAt: new Date().toISOString()
      });

      const url = new URL(window.location.href);
      url.searchParams.delete('github_connected');
      url.searchParams.delete('github_username');
      url.searchParams.delete('github_avatar');
      url.searchParams.delete('github_token');
      window.history.replaceState({}, '', url.toString());

      setChatMessages(prev => [...prev, {
        content: `GitHub connected as @${githubUsername}! You can now save your projects to GitHub.`,
        type: 'system',
        timestamp: new Date()
      }]);
    }
  }, [searchParams]);

  // Handle shouldAutoGenerate flag (set by initializePage)
  // This works with the consolidated effect above - if autoStart is already cleared,
  // this provides a fallback trigger mechanism
  useEffect(() => {
    if (!shouldAutoGenerate || showHomeScreen || autoGenerationTriggeredRef.current) {
      return;
    }

    const promptMode = sessionStorage.getItem('promptMode') === 'true';
    const pendingPrompt = sessionStorage.getItem('pendingBuildPrompt');

    // Reset the flag
    setShouldAutoGenerate(false);
    autoGenerationTriggeredRef.current = true;

    const timer = setTimeout(() => {
      if (promptMode && pendingPrompt) {
        console.log('[generation] Auto-triggering generation from prompt (fallback)');
        sessionStorage.removeItem('promptMode');
        sessionStorage.removeItem('pendingBuildPrompt');
        startPromptGeneration(pendingPrompt);
      } else if (homeUrlInput) {
        console.log('[generation] Auto-triggering generation from URL params (fallback)');
        startGeneration();
      } else {
        autoGenerationTriggeredRef.current = false;
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, homeUrlInput, showHomeScreen]);

  const hasTestingOrReviewTickets = useMemo(() => {
    return kanban.tickets.some(t => t.status === 'testing' || t.status === 'pr_review');
  }, [kanban.tickets]);

  // Keep-alive effect: ping sandbox periodically during active builds AND during human gates
  // (code review / testing) so the sandbox doesn't expire while the user is inspecting.
  useEffect(() => {
    const hasHumanGate = showCodeReview || hasTestingOrReviewTickets;

    const isViewingPreview = activeTab === 'preview' || activeTab === 'split';

    // Keep the sandbox alive while a build is running OR while the user is actively looking at the preview.
    if (!kanbanBuildActive && !generationProgress.isGenerating && !hasHumanGate && !isViewingPreview) return;
    if (!sandboxData?.sandboxId) return;

    const keepAlive = async () => {
      try {
        const response = await fetch('/api/sandbox-status');
        const data = await response.json();
        
        if (data.sandboxStopped) {
          console.log('[keep-alive] Sandbox expired during build');
          setSandboxExpired(true);
        }
      } catch (e) {
        console.error('[keep-alive] Health check failed:', e);
      }
    };

    // Ping every 2 minutes to keep sandbox alive
    const interval = setInterval(keepAlive, 2 * 60 * 1000);
    
    // Also ping immediately
    keepAlive();

    return () => clearInterval(interval);
  }, [kanbanBuildActive, generationProgress.isGenerating, sandboxData?.sandboxId, showCodeReview, hasTestingOrReviewTickets, activeTab]);

  // Handle sandbox expiration - auto-recreate if needed
  useEffect(() => {
    if (!sandboxExpired) return;

    const handleExpiredSandbox = async () => {
      console.log('[sandbox-expired] Detected expired sandbox, attempting to recreate...');
      setSandboxData(null);
      setSandboxExpired(false);

      // Create new sandbox (match the current plan template if available)
      const planBlueprint: any = (kanban.plan as any)?.blueprint || null;
      const desiredTemplate: 'vite' | 'next' =
        (kanban.plan as any)?.templateTarget ||
        planBlueprint?.templateTarget ||
        (sandboxData as any)?.templateTarget ||
        'vite';
      const nextTemplateEnabled = Boolean(appConfig?.buildSystem?.enableNextTemplate);
      const effectiveTemplate: 'vite' | 'next' =
        desiredTemplate === 'next' && !nextTemplateEnabled ? 'vite' : desiredTemplate;

      const newSandbox = await createSandbox(true, 0, effectiveTemplate);
      if (newSandbox) {
        // If we have an existing Kanban plan with ticket code, restore automatically so the preview isn't a blank starter.
        const hasRestorableTickets = (kanban.tickets || []).some(t =>
          Boolean(t.generatedCode) && ['done', 'testing', 'pr_review', 'applying', 'generating'].includes(t.status)
        );
        if ((kanban.plan as any)?.blueprint && hasRestorableTickets) {
          await restoreKanbanPlanToSandbox(newSandbox, 'recreate');
        } else {
          addChatMessage('Sandbox was recreated after expiration. Please retry your last action.', 'system');
        }
      }
    };

    handleExpiredSandbox();
  }, [sandboxExpired, appConfig?.buildSystem?.enableNextTemplate, kanban.plan, sandboxData]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = (text: string, active: boolean) => {
    setStatus({ text, active });
  };

  const log = (message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => {
    setChatMessages(prev => {
      // Skip duplicate consecutive system messages
      if (type === 'system' && prev.length > 0) {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.type === 'system' && lastMessage.content === content) {
          return prev; // Skip duplicate
        }
      }
      return [...prev, { content, type, timestamp: new Date(), metadata }];
    });
  };

  const checkAndInstallPackages = async () => {
    // This function is only called when user explicitly requests it
    // Don't show error if no sandbox - it's likely being created
    if (!sandboxData) {
      console.log('[checkAndInstallPackages] No sandbox data available yet');
      return;
    }

    // Vite error checking removed - handled by template setup
    addChatMessage('Checking packages... Sandbox is ready with Vite configuration.', 'system');
  };

  const handleSurfaceError = (_errors: any[]) => {
    // Function kept for compatibility but Vite errors are now handled by template

    // Focus the input
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };

  const installPackages = async (packages: string[]) => {
    if (!sandboxData) {
      addChatMessage('No active sandbox. Create a sandbox first!', 'system');
      return;
    }

    try {
      const response = await fetch('/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      });

      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (!data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                case 'output':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'error':
                  if (data.message && data.message !== 'undefined') {
                    addChatMessage(data.message, 'command', { commandType: 'error' });
                  }
                  break;
                case 'warning':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'success':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                case 'status':
                  addChatMessage(data.message, 'system');
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      addChatMessage(`Failed to install packages: ${error.message}`, 'system');
    }
  };

  const checkSandboxStatus = async (desiredTemplate: 'vite' | 'next' = 'vite') => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();

      const hasSandboxHint = Boolean(searchParams.get('sandbox')) || Boolean(sandboxData?.sandboxId);
      const shouldRecreate =
        Boolean(data?.sandboxStopped) ||
        (hasSandboxHint && (!data?.active || data?.sandboxData?.healthStatusCode === 410));

      if (shouldRecreate) {
        console.log('[checkSandboxStatus] Sandbox unavailable, clearing state and creating new one');
        setSandboxData(null);
        updateStatus('Sandbox stopped - creating new one...', false);
        
        // Clear old sandbox ID from URL
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('sandbox');
        router.replace(`/generation?${newParams.toString()}`, { scroll: false });
        
        const created = await createSandbox(true, 0, desiredTemplate);
        if (created) {
          // If we have an existing Kanban plan (often completed), rehydrate the new sandbox
          // so the preview returns to the generated app instead of the default Vite starter.
          const hasRestorableTickets = (kanban.tickets || []).some(t =>
            Boolean(t.generatedCode) && ['done', 'testing', 'pr_review', 'applying', 'generating'].includes(t.status)
          );
          if (kanban.plan?.blueprint && hasRestorableTickets) {
            await restoreKanbanPlanToSandbox(created, 'recreate');
          } else {
            addChatMessage('Sandbox was recreated after expiration. Please retry your last action.', 'system');
          }
        }
        return;
      }

      if (data.active && data.healthy && data.sandboxData) {
        console.log('[checkSandboxStatus] Setting sandboxData from API:', data.sandboxData);
        setSandboxData(prev => ({ ...(prev || {}), ...(data.sandboxData || {}) }));
        updateStatus('Sandbox active', true);
      } else if (data.active && !data.healthy) {
        const healthStatusCode = data?.sandboxData?.healthStatusCode;
        const healthError = data?.sandboxData?.healthError;

        updateStatus(healthStatusCode === 410 ? 'Sandbox stopped' : 'Sandbox not responding', false);
        if (healthError) {
          console.warn('[checkSandboxStatus] Sandbox health error:', healthError);
        }
      } else {
        if (!sandboxData) {
          console.log('[checkSandboxStatus] No existing sandboxData, clearing state');
          setSandboxData(null);
          updateStatus('No sandbox', false);
        } else {
          console.log('[checkSandboxStatus] Keeping existing sandboxData, sandbox inactive but data preserved');
          updateStatus('Sandbox status unknown', false);
        }
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      if (!sandboxData) {
        setSandboxData(null);
        updateStatus('Error', false);
      } else {
        updateStatus('Status check failed', false);
      }
    }
  };

  const restoreKanbanPlanToSandbox = async (
    overrideSandbox?: SandboxData,
    reason: 'manual' | 'recreate' = 'manual'
  ) => {
    if (restoringSandboxRef.current) return;

    const activeSandbox = overrideSandbox || sandboxData;
    if (!activeSandbox?.sandboxId) {
      addChatMessage('No active sandbox to restore into.', 'system');
      return;
    }

    const plan = kanban.plan;
    if (!plan?.blueprint) {
      addChatMessage('No saved blueprint/plan found to restore. Use “Plan Build” to create a new build plan.', 'system');
      return;
    }

    const restorableTickets = (kanban.tickets || [])
      .filter(t => Boolean(t.generatedCode) && ['done', 'testing', 'pr_review', 'applying', 'generating'].includes(t.status))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (restorableTickets.length === 0) {
      addChatMessage('No ticket code found to restore. Use “Plan Build” to rebuild into this sandbox.', 'system');
      return;
    }

    const planTemplate = (plan as any).templateTarget;
    const template: 'vite' | 'next' = planTemplate === 'next' || planTemplate === 'nextjs' ? 'next' : 'vite';

    restoringSandboxRef.current = true;
    setIsRestoringSandbox(true);

    try {
      addChatMessage(
        reason === 'recreate'
          ? 'Sandbox was recreated — restoring your app into the new sandbox...'
          : 'Restoring your app into this sandbox...',
        'system'
      );

      addChatMessage('Restoring scaffold from blueprint...', 'system');
      const scaffoldRes = await fetch('/api/scaffold-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId: activeSandbox.sandboxId,
          template,
          blueprint: plan.blueprint,
          uiStyle: (plan as any).uiStyle,
        }),
      });
      const scaffoldData = await scaffoldRes.json().catch(() => ({}));
      if (!scaffoldRes.ok || !scaffoldData?.success) {
        throw new Error(scaffoldData?.error || `Failed to scaffold (HTTP ${scaffoldRes.status})`);
      }

      // Mark scaffolded for this sandbox so future resumes don't try to overwrite unexpectedly.
      if (kanban.plan) {
        kanban.setPlan({
          ...kanban.plan,
          scaffolded: true,
          scaffoldedSandboxId: activeSandbox.sandboxId,
        } as any);
      }

      for (let i = 0; i < restorableTickets.length; i++) {
        const ticket = restorableTickets[i];
        if (!ticket.generatedCode) continue;
        addChatMessage(`Restoring ${i + 1}/${restorableTickets.length}: ${ticket.title}`, 'system');
        // Apply sequentially so later tickets can override earlier ones even if files shrink.
        await applyGeneratedCode(ticket.generatedCode, false, activeSandbox, { throwOnError: true });
      }

      // Re-apply Supabase env vars if present in any ticket inputs (so the restored preview switches to Supabase mode).
      const supabaseInputs = (kanban.tickets || [])
        .map(t => t.userInputs)
        .find(
          (inputs: any) =>
            inputs &&
            typeof inputs.supabase_url === 'string' &&
            inputs.supabase_url.trim().length > 0 &&
            typeof inputs.supabase_anon_key === 'string' &&
            inputs.supabase_anon_key.trim().length > 0
        ) as Record<string, string> | undefined;

      if (supabaseInputs) {
        try {
          addChatMessage('Re-applying Supabase env vars to sandbox...', 'system');
          const applyKey = `${activeSandbox.sandboxId}:${template}`;
          if (supabaseEnvAppliedRef.current !== applyKey) {
            const envRes = await fetch('/api/apply-sandbox-env', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sandboxId: activeSandbox.sandboxId,
                template,
                userInputs: supabaseInputs,
              }),
            });
            const envData = await envRes.json().catch(() => ({}));
            if (!envRes.ok || !envData?.success) {
              throw new Error(envData?.error || `Failed to apply env (HTTP ${envRes.status})`);
            }
            supabaseEnvAppliedRef.current = applyKey;
            addChatMessage('Supabase env vars applied to sandbox.', 'system');
          }
        } catch (e: any) {
          console.warn('[restoreKanbanPlanToSandbox] Failed to apply Supabase env:', e);
          addChatMessage(
            `Warning: could not apply Supabase env vars automatically (${e?.message || 'unknown error'}).`,
            'system'
          );
        }
      }

      addChatMessage('✅ Restore complete. Reloading preview…', 'system');
      if (iframeRef.current && activeSandbox.url) {
        iframeRef.current.src = `${activeSandbox.url}?t=${Date.now()}&restored=true`;
      }
    } catch (e: any) {
      console.warn('[restoreKanbanPlanToSandbox] Restore failed:', e);
      addChatMessage(`Restore failed: ${e?.message || 'unknown error'}`, 'system');
    } finally {
      setIsRestoringSandbox(false);
      restoringSandboxRef.current = false;
    }
  };

  const generateUIOptions = async (prompt: string): Promise<UIOption[]> => {
    setIsLoadingUIOptions(true);
    setShowUIOptions(true);
    setPendingPrompt(prompt);

    try {
      const response = await fetch('/api/generate-ui-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate UI options');
      }

      const data = await response.json();
      setUIOptions(data.options || []);
      return data.options || [];
    } catch (error: any) {
      console.error('Error generating UI options:', error);
      addChatMessage(`Failed to generate UI options: ${error.message}`, 'error');
      setShowUIOptions(false);
      return [];
    } finally {
      setIsLoadingUIOptions(false);
    }
  };

  const handleUIOptionSelect = async (option: UIOption) => {
    setSelectedUIOption(option);
    setShowUIOptions(false);

    // Enhance the prompt with selected UI style
    const enhancedPrompt = `${pendingPrompt}

UI DESIGN REQUIREMENTS (Selected Style: "${option.name}"):
- Style: ${option.style}
- Color Scheme:
  - Primary: ${option.colorScheme.primary}
  - Secondary: ${option.colorScheme.secondary}
  - Accent: ${option.colorScheme.accent}
  - Background: ${option.colorScheme.background}
  - Text: ${option.colorScheme.text}
- Layout: ${option.layout}
- Visual Features: ${option.features.join(', ')}
- Description: ${option.description}

Apply these design specifications consistently across all components.`;

    await planBuild(enhancedPrompt, option);
  };

  const handleUIOptionsCancel = () => {
    setShowUIOptions(false);
    setUIOptions([]);
    setPendingPrompt('');
  };

  const handleCodeReviewApprove = () => {
    if (!pendingReviewData) return;
    
    pendingReviewData.tickets.forEach(ticket => {
      kanban.updateTicketStatus(ticket.id, 'done');
      kanban.updateTicketProgress(ticket.id, 100);
    });

    if (gitSync.isEnabled && pendingReviewData.fileContents.length > 0) {
      const combinedTicket = {
        id: pendingReviewData.tickets.map(t => t.id).join('-'),
        title: `Build: ${pendingReviewData.tickets.map(t => t.title).join(', ')}`,
        description: `Completed ${pendingReviewData.tickets.length} features (approved despite issues)`,
        type: 'feature' as const,
        priority: 'medium' as const,
        status: 'done' as const,
      };
      gitSync.syncTicketCompletion(combinedTicket, pendingReviewData.fileContents);
    }

    addChatMessage('✅ Changes approved. Continuing build...', 'system');
    setShowCodeReview(false);
    setPendingReviewData(null);
    bugbot.clearLastReview();
    setGenerationProgress(prev => ({ ...prev, status: 'Continuing build...' }));
    setResumeAfterReview(true);
  };

  const handleCodeReviewDismiss = () => {
    setShowCodeReview(false);
    if (pendingReviewData) {
      pendingReviewData.tickets.forEach(ticket => {
        kanban.updateTicketStatus(ticket.id, 'testing');
      });
    }
    addChatMessage('📝 Code review dismissed. Tickets moved to testing.', 'system');
  };

  const STATUS_ORDER: Record<TicketStatus, number> = {
    planning: 0,
    backlog: 1,
    awaiting_input: 2,
    generating: 3,
    applying: 4,
    testing: 5,
    pr_review: 6,
    done: 7,
    blocked: -1,
    failed: -1,
    skipped: -1,
  };

  const COLUMN_NAMES: Record<TicketStatus, string> = {
    planning: 'Planning',
    backlog: 'Backlog',
    awaiting_input: 'Awaiting Input',
    generating: 'Generating',
    applying: 'Applying',
    testing: 'Testing',
    pr_review: 'PR Review',
    done: 'Done',
    blocked: 'Blocked',
    failed: 'Failed',
    skipped: 'Skipped',
  };

  const isRegressionMove = (fromStatus: TicketStatus, toStatus: TicketStatus): boolean => {
    const fromOrder = STATUS_ORDER[fromStatus];
    const toOrder = STATUS_ORDER[toStatus];
    return fromOrder >= 0 && toOrder >= 0 && fromOrder >= STATUS_ORDER.pr_review && toOrder < fromOrder;
  };

  const handleMoveTicket = (ticketId: string, newStatus: TicketStatus) => {
    const ticket = kanban.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      kanban.moveTicket(ticketId, newStatus);
      return;
    }

    if (isRegressionMove(ticket.status, newStatus) && ticket.actualFiles.length > 0) {
      setRegressionWarning({
        isOpen: true,
        ticketId,
        ticketTitle: ticket.title,
        fromColumn: COLUMN_NAMES[ticket.status],
        toColumn: COLUMN_NAMES[newStatus],
        newStatus,
      });
      return;
    }

    kanban.moveTicket(ticketId, newStatus);
  };

  const handleRegressionConfirm = async () => {
    if (!regressionWarning || !sandboxData) {
      setRegressionWarning(null);
      return;
    }

    const ticket = kanban.tickets.find(t => t.id === regressionWarning.ticketId);
    if (!ticket) {
      setRegressionWarning(null);
      return;
    }

    addChatMessage(`🔄 Reverting ticket: ${ticket.title}...`, 'system');

    const result = await softDelete.softDeleteTicketCode(sandboxData.sandboxId, {
      id: ticket.id,
      title: ticket.title,
      actualFiles: ticket.actualFiles,
    });

    if (result && result.success) {
      addChatMessage(`✅ Soft deleted ${result.processedFiles.length} file(s). Code commented out.`, 'system');

      addChatMessage('🔧 Running auto-refactor to clean up dependencies...', 'system');
      const refactorResult = await autoRefactor.refactorAfterSoftDelete(
        sandboxData.sandboxId,
        result.processedFiles,
        ticket.id
      );

      if (refactorResult && refactorResult.changesApplied > 0) {
        addChatMessage(`✅ Auto-refactor applied ${refactorResult.changesApplied} fixes`, 'system');
      }

      kanban.moveTicket(regressionWarning.ticketId, regressionWarning.newStatus);
    } else {
      addChatMessage(`⚠️ Soft delete had issues, but proceeding with move.`, 'system');
      kanban.moveTicket(regressionWarning.ticketId, regressionWarning.newStatus);
    }

    setRegressionWarning(null);
  };

  const handleRegressionCancel = () => {
    setRegressionWarning(null);
  };

  const planBuild = async (prompt: string, uiStyle?: UIOption, context?: any) => {
    setIsPlanning(true);
    kanban.setTickets([]);

    try {
      const response = await fetch('/api/plan-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          context,
          uiStyle: uiStyle ? {
            name: uiStyle.name,
            description: uiStyle.description,
            style: uiStyle.style,
            colorScheme: uiStyle.colorScheme,
            layout: uiStyle.layout,
            features: uiStyle.features,
          } : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to create build plan');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'ticket') {
                kanban.setTickets(prev => [...prev, data.ticket]);
              } else if (data.type === 'plan_complete') {
                const serverPlan = data.plan;
                kanban.setPlan({
                  ...serverPlan,
                  uiStyle:
                    serverPlan?.uiStyle ||
                    (uiStyle
                      ? {
                          name: uiStyle.name,
                          description: uiStyle.description,
                          style: uiStyle.style,
                          colorScheme: uiStyle.colorScheme,
                          layout: uiStyle.layout,
                          features: uiStyle.features,
                        }
                      : undefined),
                });
                // Snapshot the initial plan (for plan versioning)
                if (data.plan?.tickets && Array.isArray(data.plan.tickets) && data.plan.tickets.length > 0) {
                  void planVersions.createSnapshot({
                    source: 'initial_plan',
                    name: '📦 Initial plan',
                    description: 'Snapshot captured when planning completed',
                    tickets: data.plan.tickets,
                    planIdOverride: data.plan?.id || null,
                  });
                }
              }
            } catch (e) {
              console.error('Failed to parse plan event:', e);
            }
          }
        }
      }
    } catch (error: any) {
      addChatMessage(`Failed to create build plan: ${error.message}`, 'system');
    } finally {
      setIsPlanning(false);
    }
  };

  const truncateForPrompt = (content: string, maxChars: number) => {
    if (!content) return '';
    if (content.length <= maxChars) return content;
    return `${content.slice(0, maxChars)}\n\n// ... truncated ...`;
  };

  const buildGitHubImportPlanningContext = (files: Array<{ path: string; content: string }>) => {
    const filePaths = files.map(f => f.path).sort();

    const fileList = filePaths
      .slice(0, 200)
      .map(p => `- ${p}`)
      .join('\n');

    const find = (path: string) => files.find(f => f.path === path);
    const keyPaths = [
      'package.json',
      'README.md',
      'README.mdx',
      'src/main.tsx',
      'src/main.jsx',
      'src/App.tsx',
      'src/App.jsx',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
    ];

    const keySnippets = keyPaths
      .map(path => {
        const file = find(path);
        if (!file) return null;
        return `// FILE: ${path}\n${truncateForPrompt(file.content, 2500)}`;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');

    const contextText = `Repo files (showing ${Math.min(filePaths.length, 200)} of ${filePaths.length}):\n${fileList}\n\nKey files:\n${keySnippets || '(none found)'}`;
    return { filePaths, contextText };
  };

  const handleGitHubImportAndPlan = async (
    repoFullName: string,
    branch: string,
    maxFiles: number,
    model: string,
    goalPrompt?: string
  ) => {
    setIsImportingRepo(true);
    setHasInitialSubmission(true);
    setAiModel(model);
    setActiveTab('kanban');

    try {
      addChatMessage(`🐙 Importing GitHub repo ${repoFullName}@${branch} (up to ${maxFiles} files)...`, 'system');

      const result = await githubImport.importRepo(repoFullName, branch, maxFiles);
      if (!result?.success) {
        throw new Error(githubImport.error || 'Import failed');
      }

      addChatMessage(`✅ Imported ${result.importedFiles} file(s) from ${repoFullName}@${branch}`, 'system');
      setLastImportedRepo({ repoFullName, branch });

      const { filePaths, contextText } = buildGitHubImportPlanningContext(result.files);
      const goal =
        goalPrompt?.trim() ||
        'Analyze this codebase and propose a safe, incremental plan to improve it and implement missing MVP features.';

      const prompt = `You are planning changes for an existing codebase imported from GitHub.

Repo: ${repoFullName}
Branch: ${branch}

User goal:
${goal}

Context:
${contextText}

Requirements:
- Prefer modifying existing files over creating new ones.
- Keep changes incremental, testable, and dependency-aware.
- Include a ticket to verify build/run if the repo appears to be a React/Vite app.`;

      await planBuild(prompt, undefined, { existingFiles: filePaths, github: { repoFullName, branch } });
    } catch (error: any) {
      console.error('[GitHub Import] Failed:', error);
      addChatMessage(`❌ GitHub import failed: ${error.message}`, 'error');
      setLastImportedRepo(null);
      setHasInitialSubmission(false);
    } finally {
      setIsImportingRepo(false);
    }
  };

  const handleLoadImportedRepoIntoSandbox = async () => {
    if (!sandboxData) {
      addChatMessage('❌ No active sandbox to load into. Create a sandbox first.', 'error');
      return;
    }

    if (!lastImportedRepo) {
      addChatMessage('❌ No imported repo found. Import a repo first.', 'error');
      return;
    }

    setIsLoadingRepoIntoSandbox(true);
    try {
      addChatMessage(
        `⬇️ Loading ${lastImportedRepo.repoFullName}@${lastImportedRepo.branch} into sandbox...`,
        'system'
      );

      setRepoLoadModalOpen(true);
      setRepoLoadStatus('running');
      setRepoLoadError(null);
      setRepoLoadLogs([]);
      setRepoLoadSteps([
        { id: 'stop_vite', label: 'Stopping dev server', status: 'pending' },
        { id: 'clear_sandbox', label: 'Clearing sandbox files', status: 'pending' },
        { id: 'download', label: 'Downloading repository', status: 'pending' },
        { id: 'extract', label: 'Extracting repository', status: 'pending' },
        { id: 'cleanup', label: 'Cleaning up', status: 'pending' },
        { id: 'vite_config', label: 'Configuring Vite host allowlist', status: 'pending' },
        { id: 'npm_install', label: 'Installing dependencies', status: 'pending' },
        { id: 'restart_vite', label: 'Restarting dev server', status: 'pending' },
      ]);

      const response = await fetch('/api/github/load-into-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId: sandboxData.sandboxId,
          repoFullName: lastImportedRepo.repoFullName,
          branch: lastImportedRepo.branch,
        }),
      });

      // If server returned a non-stream error, handle it
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to load repo into sandbox (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sawComplete = false;
      let sawError = false;
      let errorMessage: string | null = null;

      const updateStep = (stepId: string, status: 'pending' | 'running' | 'done' | 'error', detail?: string) => {
        setRepoLoadSteps(prev =>
          prev.map(s => (s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s))
        );
      };

      const appendLog = (line: string) => {
        const trimmed = line?.trim();
        if (!trimmed) return;
        setRepoLoadLogs(prev => [...prev, trimmed].slice(-200));
      };

      const handleEvent = (evt: any) => {
        if (!evt || typeof evt !== 'object') return;
        if (evt.type === 'step' && typeof evt.step === 'string') {
          const status = evt.status as any;
          if (status === 'running' || status === 'done' || status === 'error') {
            updateStep(evt.step, status, evt.detail || evt.message);
          }
          return;
        }

        if (evt.type === 'log') {
          appendLog(`[${evt.step || 'log'}]\n${evt.message || ''}`.trim());
          return;
        }

        if (evt.type === 'error') {
          sawError = true;
          errorMessage = evt.message || 'Failed to load repo into sandbox';
          setRepoLoadStatus('error');
          setRepoLoadError(errorMessage);
          return;
        }

        if (evt.type === 'complete') {
          sawComplete = true;
          setRepoLoadStatus('success');
          return;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            try {
              const evt = JSON.parse(raw);
              handleEvent(evt);
            } catch {
              // ignore malformed chunks
            }
          }
        }
      }

      if (sawError) {
        throw new Error(errorMessage || 'Failed to load repo into sandbox');
      }

      // If we didn't get an explicit complete event, treat stream end as success
      if (!sawComplete) {
        setRepoLoadStatus(prev => (prev === 'running' ? 'success' : prev));
      }

      addChatMessage('✅ Repo loaded into sandbox. Dev server restarted.', 'system');

      // Force refresh the preview iframe (if mounted)
      if (iframeRef.current && sandboxData.url) {
        iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
      }
      setIsPreviewRefreshing(true);
      setTimeout(() => setIsPreviewRefreshing(false), 1000);
    } catch (error: any) {
      console.error('[GitHub Load Into Sandbox] Failed:', error);
      addChatMessage(`❌ Failed to load repo into sandbox: ${error.message}`, 'error');
      setRepoLoadStatus('error');
      setRepoLoadError(error.message || 'Failed to load repo into sandbox');
    } finally {
      setIsLoadingRepoIntoSandbox(false);
    }
  };

  const handleStartKanbanBuild = async (opts?: { onlyTicketId?: string }) => {
    const backlogTickets = kanban.tickets.filter(t => t.status === 'backlog');
    const awaitingInputTickets = kanban.tickets.filter(t => t.status === 'awaiting_input');

    if (backlogTickets.length === 0 && awaitingInputTickets.length === 0) return;

    if (awaitingInputTickets.length > 0 && backlogTickets.length > 0) {
      addChatMessage(`${awaitingInputTickets.length} task(s) require input and will be skipped. Building ${backlogTickets.length} ready task(s).`, 'system');
    } else if (awaitingInputTickets.length > 0 && backlogTickets.length === 0) {
      addChatMessage(`${awaitingInputTickets.length} task(s) require input before building. Please provide the required credentials/API keys.`, 'system');
      return;
    }

    // Snapshot the plan as it is being locked for execution ("Move to Pipeline")
    void planVersions.createSnapshot({
      source: 'move_to_pipeline',
      name: '🔒 Plan locked (Move to Pipeline)',
      description: 'Snapshot captured when build started',
      tickets: kanban.tickets,
      planIdOverride: kanban.plan?.id || null,
    });

    setKanbanBuildActive(true);
    kanban.setIsPaused(false);

    const blueprintBuildsEnabled = Boolean(appConfig?.buildSystem?.enableBlueprintBuilds);
    const nextTemplateEnabled = Boolean(appConfig?.buildSystem?.enableNextTemplate);

    // Determine template + blueprint (if available)
    const planBlueprint: any = (kanban.plan as any)?.blueprint || null;
    const desiredTemplate: 'vite' | 'next' =
      (kanban.plan as any)?.templateTarget ||
      planBlueprint?.templateTarget ||
      'vite';
    const effectiveTemplate: 'vite' | 'next' =
      desiredTemplate === 'next' && !nextTemplateEnabled ? 'vite' : desiredTemplate;

    // Ensure sandbox exists (and matches the plan template)
    let activeSandbox = sandboxData as any;
    // Proactively detect expired/stopped sandboxes before starting a build.
    // If the server lost the provider (or the sandbox expired), force a new sandbox.
    try {
      const statusRes = await fetch('/api/sandbox-status');
      const statusData = await statusRes.json().catch(() => null);

      // IMPORTANT: The server maintains the authoritative "active sandbox".
      // The client can hold a stale sandboxId (e.g., URL param from a prior run),
      // which causes scaffold/apply routes to 400 because the provider is registered under
      // a different sandboxId. Always sync from `/api/sandbox-status` before scaffolding.
      const statusSandbox =
        statusData?.sandboxData && typeof statusData.sandboxData === 'object'
          ? statusData.sandboxData
          : null;

      if (statusData?.active && statusData?.healthy && statusSandbox?.sandboxId) {
        // Sync local state + our local variable so subsequent calls use the correct sandboxId immediately.
        setSandboxData(prev => ({ ...(prev || {}), ...(statusSandbox || {}) }));
        activeSandbox = { ...(activeSandbox || {}), ...(statusSandbox || {}) };

        // Keep the URL param aligned as well (helps refresh/resume flows).
        const currentSandboxParam = searchParams.get('sandbox');
        if (currentSandboxParam !== statusSandbox.sandboxId) {
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.set('sandbox', statusSandbox.sandboxId);
          router.replace(`/generation?${newParams.toString()}`, { scroll: false });
        }
      }
      const sandboxUnavailable =
        !statusData?.active ||
        Boolean(statusData?.sandboxStopped) ||
        statusSandbox?.healthStatusCode === 410;
      if (sandboxUnavailable) {
        if (activeSandbox) {
          addChatMessage('Sandbox is no longer available. Creating a new sandbox before continuing...', 'system');
        }
        setSandboxData(null);
        activeSandbox = null;
      }
    } catch (e) {
      // If status check fails, proceed with current state; downstream operations may still recreate.
      console.warn('[handleStartKanbanBuild] Sandbox status preflight failed:', e);
    }
    if (!activeSandbox || activeSandbox.templateTarget !== effectiveTemplate) {
      if (activeSandbox?.templateTarget && activeSandbox.templateTarget !== effectiveTemplate) {
        addChatMessage('Current sandbox template does not match the plan. Creating a new sandbox...', 'system');
      }
      const newSandbox = await createSandbox(true, 0, effectiveTemplate);
      activeSandbox = newSandbox || activeSandbox;

      // `createSandbox` can return null if a sandbox creation is already in progress.
      // In that case, wait briefly for the server-side active sandbox to become healthy.
      if (!activeSandbox) {
        const started = Date.now();
        const maxWaitMs = 30000;

        while (Date.now() - started < maxWaitMs) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            const waitRes = await fetch('/api/sandbox-status');
            const waitData = await waitRes.json().catch(() => null);
            const waitSandbox =
              waitData?.sandboxData && typeof waitData.sandboxData === 'object'
                ? waitData.sandboxData
                : null;

            if (waitData?.active && waitData?.healthy && waitSandbox?.sandboxId) {
              setSandboxData(prev => ({ ...(prev || {}), ...(waitSandbox || {}), templateTarget: effectiveTemplate } as any));
              activeSandbox = { ...(waitSandbox || {}), templateTarget: effectiveTemplate };

              const currentSandboxParam = searchParams.get('sandbox');
              if (currentSandboxParam !== waitSandbox.sandboxId) {
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.set('sandbox', waitSandbox.sandboxId);
                router.replace(`/generation?${newParams.toString()}`, { scroll: false });
              }
              break;
            }
          } catch {
            // ignore and keep waiting
          }
        }
      }
      if (!activeSandbox) {
        setKanbanBuildActive(false);
        addChatMessage('Failed to create sandbox. Please try again.', 'error');
        return;
      }
    }

    // Deterministic scaffold step (guarantees routes/nav/data are present before AI edits)
    if (blueprintBuildsEnabled && planBlueprint) {
      try {
        const alreadyScaffoldedForSandbox =
          Boolean((kanban.plan as any)?.scaffolded) &&
          Boolean((kanban.plan as any)?.scaffoldedSandboxId) &&
          (kanban.plan as any)?.scaffoldedSandboxId === activeSandbox.sandboxId;

        if (!alreadyScaffoldedForSandbox) {
          addChatMessage('Scaffolding project from blueprint...', 'system');
          const scaffoldRes = await fetch('/api/scaffold-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sandboxId: activeSandbox.sandboxId,
              template: effectiveTemplate,
              blueprint: planBlueprint,
              uiStyle: (kanban.plan as any)?.uiStyle,
            }),
          });
          const scaffoldData = await scaffoldRes.json().catch(() => ({}));
          if (!scaffoldRes.ok || !scaffoldData?.success) {
            throw new Error(scaffoldData?.error || `Scaffold failed (HTTP ${scaffoldRes.status})`);
          }
          addChatMessage(`Scaffolded ${scaffoldData.filesWritten?.length || 0} file(s)`, 'system');

          if (kanban.plan) {
            kanban.setPlan({
              ...kanban.plan,
              scaffolded: true,
              scaffoldedSandboxId: activeSandbox.sandboxId,
            } as any);
          }
        }
      } catch (e: any) {
        setKanbanBuildActive(false);
        addChatMessage(`Scaffolding failed: ${e.message}`, 'error');
        return;
      }
    } else if (planBlueprint) {
      addChatMessage('Blueprint builds are disabled; skipping scaffold step.', 'system');
    } else {
      addChatMessage('No blueprint found; skipping scaffold step.', 'system');
    }

    // If the plan already has stored Supabase credentials, apply them to this sandbox up-front.
    // This ensures the preview can switch to Supabase mode even if the Supabase tickets were
    // completed in a previous run (or if the user adds follow-up tickets later).
    const supabaseInputsFromPlan = (kanban.tickets || [])
      .map(t => t.userInputs)
      .find(
        (inputs: any) =>
          inputs &&
          typeof inputs.supabase_url === 'string' &&
          inputs.supabase_url.trim().length > 0 &&
          typeof inputs.supabase_anon_key === 'string' &&
          inputs.supabase_anon_key.trim().length > 0
      ) as Record<string, string> | undefined;

    if (supabaseInputsFromPlan) {
      const applyKey = `${activeSandbox.sandboxId}:${effectiveTemplate}`;
      if (supabaseEnvAppliedRef.current !== applyKey) {
        try {
          addChatMessage('Applying Supabase env vars to sandbox...', 'system');
          const envRes = await fetch('/api/apply-sandbox-env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sandboxId: activeSandbox.sandboxId,
              template: effectiveTemplate,
              userInputs: supabaseInputsFromPlan,
            }),
          });
          const envData = await envRes.json().catch(() => ({}));
          if (!envRes.ok || !envData?.success) {
            throw new Error(envData?.error || `Failed to apply env (HTTP ${envRes.status})`);
          }
          supabaseEnvAppliedRef.current = applyKey;
          addChatMessage('Supabase env vars applied to sandbox.', 'system');
        } catch (e: any) {
          console.warn('[generation] Failed to apply Supabase env vars (preflight):', e);
          addChatMessage(
            `Warning: could not apply Supabase env vars automatically (${e?.message || 'unknown error'}).`,
            'system'
          );
        }
      }
    }

    setGenerationProgress(prev => ({
      ...prev,
      isGenerating: true,
      status: 'Building tickets...',
      streamedCode: '',
      files: [],
    }));

    const redactSensitiveForPrompt = (content: string): string => {
      const input = String(content ?? '');
      return input
        // JWTs (common Supabase anon keys are JWT-like)
        .replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, '[REDACTED_JWT]')
        // Common env key assignment patterns
        .replace(/(VITE_SUPABASE_ANON_KEY\s*[:=]\s*['"])([^'"]+)(['"])/g, '$1[REDACTED]$3')
        .replace(/(NEXT_PUBLIC_SUPABASE_ANON_KEY\s*[:=]\s*['"])([^'"]+)(['"])/g, '$1[REDACTED]$3');
    };

    const streamFileBlocksFromAI = async (prompt: string, sandboxId: string): Promise<string> => {
      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: aiModel,
          context: { sandboxId },
          isEdit: true,
          buildProfile: 'implement_ticket',
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`AI generation failed (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let generatedCode = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'stream' && data.raw) {
              generatedCode += data.text;
            } else if (data.type === 'complete') {
              generatedCode = data.generatedCode || generatedCode;
            }
          } catch {
            // ignore partial chunks
          }
        }
      }

      return generatedCode;
    };

    try {
      while (true) {
        if (kanban.isPaused) {
          addChatMessage('Build paused.', 'system');
          break;
        }

        const nextTicket = opts?.onlyTicketId
          ? (() => {
              const res = kanban.buildSingleTicket(opts.onlyTicketId);
              if (!res) return null;
              if (typeof (res as any).error === 'string') {
                addChatMessage(`❌ Can't build that ticket yet: ${(res as any).error}`, 'error');
                return null;
              }
              return res as any;
            })()
          : kanban.getNextBuildableTicket();

        if (!nextTicket) break;

        kanban.setCurrentTicketId(nextTicket.id);
        kanban.updateTicketStatus(nextTicket.id, 'generating');
        kanban.updateTicketProgress(nextTicket.id, 5);

        // If this ticket has Supabase credentials, apply them to the sandbox env once (and restart dev server)
        // so the generated app can actually switch from mock-first → real DB without manual steps.
        const isSupabaseTicket =
          /supabase/i.test(nextTicket.title || '') ||
          /supabase/i.test(nextTicket.description || '') ||
          Array.isArray((nextTicket as any).inputRequests) &&
            (nextTicket as any).inputRequests.some((r: any) => typeof r?.id === 'string' && r.id.startsWith('supabase_'));

        const hasSupabaseInputs =
          nextTicket.userInputs &&
          typeof (nextTicket.userInputs as any).supabase_url === 'string' &&
          String((nextTicket.userInputs as any).supabase_url).trim().length > 0 &&
          typeof (nextTicket.userInputs as any).supabase_anon_key === 'string' &&
          String((nextTicket.userInputs as any).supabase_anon_key).trim().length > 0;

        if (isSupabaseTicket && hasSupabaseInputs) {
          const applyKey = `${activeSandbox.sandboxId}:${effectiveTemplate}`;
          if (supabaseEnvAppliedRef.current !== applyKey) {
            try {
              addChatMessage('Applying Supabase env vars to sandbox...', 'system');
              const envRes = await fetch('/api/apply-sandbox-env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sandboxId: activeSandbox.sandboxId,
                  template: effectiveTemplate,
                  userInputs: nextTicket.userInputs,
                }),
              });
              const envData = await envRes.json().catch(() => ({}));
              if (!envRes.ok || !envData?.success) {
                throw new Error(envData?.error || `Failed to apply env (HTTP ${envRes.status})`);
              }
              supabaseEnvAppliedRef.current = applyKey;
              addChatMessage('Supabase env vars applied to sandbox.', 'system');
            } catch (e: any) {
              console.warn('[generation] Failed to apply Supabase env vars:', e);
              addChatMessage(
                `Warning: could not apply Supabase env vars automatically (${e?.message || 'unknown error'}).`,
                'system'
              );
            }
          }
        }

        // Never include sensitive user-provided values in the LLM prompt.
        const sensitiveIds = new Set(
          Array.isArray((nextTicket as any).inputRequests)
            ? (nextTicket as any).inputRequests.filter((r: any) => r?.sensitive).map((r: any) => r?.id)
            : []
        );

        const credentialText =
          nextTicket.userInputs && Object.keys(nextTicket.userInputs).length > 0
            ? `\n\nUser inputs:\n${Object.entries(nextTicket.userInputs)
                .map(([k, v]) => {
                  if (sensitiveIds.has(k)) return `- ${k}=[REDACTED]`;
                  const str = String(v ?? '');
                  // Avoid dumping long values into prompts even if not marked sensitive.
                  if (str.length > 120) return `- ${k}=[REDACTED]`;
                  return `- ${k}=${str}`;
                })
                .join('\n')}`
            : '';

        const uiStyleForPrompt = (kanban.plan as any)?.uiStyle;
        const uiStyleBlock = uiStyleForPrompt
          ? `\n\nUI STYLE (apply consistently across all tickets):\n${JSON.stringify(uiStyleForPrompt, null, 2)}\n\nUI RULES:\n- Keep the UI visually rich (layered sections, modern spacing/typography, hover+focus states, and polished empty/loading states).\n- Do NOT drift to a generic default look; follow the selected style + blueprint theme.\n- Reuse the existing UI primitives in the codebase. Do NOT create duplicate UI kits.\n  - Vite primitives live in src/components/ui/* (Button, Card, Input, Badge, Skeleton, EmptyState, DataTable, Tabs, Modal) and src/lib/cn.js\n  - Next primitives live in components/ui/* (Button, Card, Input, Badge, Skeleton, EmptyState, DataTable, Tabs, Modal) and lib/cn.ts\n- If you need a new primitive, EXTEND the existing components in those folders instead of creating a parallel set.\n`
          : '';

        const ticketPrompt = `Implement the following ticket in the existing application.\n\nTemplate: ${desiredTemplate}\n${uiStyleBlock}\nBlueprint (high-level contract):\n${planBlueprint ? JSON.stringify(planBlueprint, null, 2) : '(none)'}\n\nTicket:\n- Title: ${nextTicket.title}\n- Description: ${nextTicket.description}${credentialText}\n\nRules:\n- Implement the ticket completely.\n- Preserve existing routes/navigation and the mock-first data layer.\n- Create new files if required by this ticket.\n- Output ONLY <file path=\"...\"> blocks for files you changed/created.`;

        const response = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: ticketPrompt,
            model: aiModel,
            context: { sandboxId: activeSandbox.sandboxId },
            isEdit: true,
            buildProfile: 'implement_ticket',
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Generation failed for "${nextTicket.title}" (HTTP ${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';

        setGenerationProgress(prev => ({
          ...prev,
          status: `Generating: ${nextTicket.title}`,
          streamedCode: '',
        }));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'stream' && data.raw) {
                generatedCode += data.text;
                const progress = Math.min(85, Math.max(10, (generatedCode.length / 6000) * 100));
                kanban.updateTicketProgress(nextTicket.id, progress);
                setGenerationProgress(prev => ({ ...prev, streamedCode: generatedCode }));
              } else if (data.type === 'complete') {
                generatedCode = data.generatedCode || generatedCode;
              }
            } catch {
              // ignore partial chunks
            }
          }
        }

        kanban.updateTicketCode(nextTicket.id, generatedCode);

        // Apply generated code (incremental edit)
        kanban.updateTicketStatus(nextTicket.id, 'applying');
        kanban.updateTicketProgress(nextTicket.id, 90);
        setGenerationProgress(prev => ({ ...prev, status: `Applying: ${nextTicket.title}` }));
        setActiveTab('preview');
        const applyOutcome = await applyGeneratedCode(generatedCode, true, activeSandbox, { throwOnError: true });

        const appliedFiles = Array.from(new Set(applyOutcome.appliedFiles || []));
        const allFiles =
          appliedFiles.length > 0
            ? appliedFiles
            : Array.from(generatedCode.matchAll(/<file path="([^"]+)">/g)).map(m => m[1]);
        if (allFiles.length > 0) {
          kanban.updateTicketFiles(nextTicket.id, allFiles);
        }
        const appliedFilesSet = new Set(allFiles);

        // Code review gate (Bugbot)
        kanban.updateTicketStatus(nextTicket.id, 'pr_review');
        kanban.updateTicketProgress(nextTicket.id, 95);
        setGenerationProgress(prev => ({ ...prev, status: `Reviewing: ${nextTicket.title}` }));

        const fileContents: Array<{ path: string; content: string }> = [];
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|(?=<file path="|$))/g;
        let fileMatch;
        while ((fileMatch = fileRegex.exec(generatedCode)) !== null) {
          fileContents.push({ path: fileMatch[1], content: fileMatch[2].trim() });
        }

        const reviewResult = await bugbot.reviewCode({
          ticketId: nextTicket.id,
          ticketTitle: nextTicket.title,
          files: fileContents,
        });

        const isBlockingIssue = (issue: { severity: string; type: string }) => {
          if (issue.severity === 'error') return true;
          if (issue.severity === 'warning' && (issue.type === 'security' || issue.type === 'bug')) return true;
          return false;
        };

        const hasBlockingIssues = (res: ReviewResult | null) =>
          Boolean(res?.issues?.some(i => isBlockingIssue(i)));

        const maxAutoFixAttempts = 2;
        let currentReview: ReviewResult | null = reviewResult;
        let currentFiles = fileContents;
        let autoFixAttempts = 0;

        while (hasBlockingIssues(currentReview) && autoFixAttempts < maxAutoFixAttempts) {
          autoFixAttempts += 1;

          const blockingIssues = (currentReview?.issues || []).filter(i => isBlockingIssue(i));
          const issuesText = blockingIssues
            .map((i, idx) => {
              const loc = `${i.file}${i.line ? `:${i.line}` : ''}`;
              const suggestion = i.suggestion ? `\n  Suggestion: ${i.suggestion}` : '';
              return `- [${idx + 1}] (${i.severity}/${i.type}) ${loc}\n  ${i.message}${suggestion}`;
            })
            .join('\n');

          const filesText = currentFiles
            .map(f => `// FILE: ${f.path}\n${redactSensitiveForPrompt(f.content)}`)
            .join('\n\n---\n\n');

          addChatMessage(
            `Code review found blocking issues. Attempting auto-fix (${autoFixAttempts}/${maxAutoFixAttempts})...`,
            'system'
          );
          setGenerationProgress(prev => ({
            ...prev,
            status: `Auto-fixing: ${nextTicket.title} (${autoFixAttempts}/${maxAutoFixAttempts})`,
          }));

          const fixPrompt = `Fix the listed issues in the provided code.\n\nBlocking issues:\n${issuesText}\n\nRules:\n- Make the smallest possible changes to fix ONLY the issues above.\n- Do NOT change app behavior beyond what is needed to fix the issues.\n- Do NOT introduce new dependencies unless absolutely necessary.\n- Do NOT include or log secrets.\n- Output ONLY <file path=\"...\"> blocks for files you change. Each block must contain the full updated file content.\n\nCode:\n${filesText}`;

          let fixCode = '';
          try {
            fixCode = await streamFileBlocksFromAI(fixPrompt, activeSandbox.sandboxId);
          } catch (e: any) {
            console.warn('[kanban] Auto-fix generation failed:', e);
            break;
          }

          if (!fixCode || !fixCode.includes('<file path="')) {
            console.warn('[kanban] Auto-fix produced no file blocks; stopping auto-fix loop.');
            break;
          }

          // Apply the fix patch (incremental edit)
          const fixApplyOutcome = await applyGeneratedCode(fixCode, true, activeSandbox, { throwOnError: true });
          for (const p of fixApplyOutcome.appliedFiles || []) {
            appliedFilesSet.add(p);
          }

          // Update the in-memory file set for the next Bugbot pass using the returned <file> blocks.
          const updatedMap = new Map(currentFiles.map(f => [f.path, f.content]));
          const fixFileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|(?=<file path="|$))/g;
          let fixMatch;
          while ((fixMatch = fixFileRegex.exec(fixCode)) !== null) {
            updatedMap.set(fixMatch[1], fixMatch[2].trim());
          }
          currentFiles = Array.from(updatedMap.entries()).map(([path, content]) => ({ path, content }));

          currentReview = await bugbot.reviewCode({
            ticketId: nextTicket.id,
            ticketTitle: nextTicket.title,
            files: currentFiles,
          });
        }

        // Persist the final ticket code after any auto-fixes so restore + traceability remain accurate.
        if (currentFiles.length > 0) {
          const finalGeneratedCode = currentFiles
            .map(f => `<file path="${f.path}">\n${f.content}\n</file>`)
            .join('\n\n');
          kanban.updateTicketCode(nextTicket.id, finalGeneratedCode);
          const finalFiles = Array.from(
            new Set([
              ...Array.from(appliedFilesSet),
              ...currentFiles.map(f => f.path),
            ])
          );
          if (finalFiles.length > 0) {
            kanban.updateTicketFiles(nextTicket.id, finalFiles);
          }
        }

        if (hasBlockingIssues(currentReview)) {
          const errors = (currentReview?.issues || []).filter(i => i.severity === 'error').length;
          setPendingReviewData({ tickets: [nextTicket], fileContents: currentFiles });
          setShowCodeReview(true);
          setKanbanBuildActive(false);
          setGenerationProgress(prev => ({
            ...prev,
            isGenerating: false,
            status: `Review failed: ${errors} error(s)`,
          }));
          addChatMessage('Code review found blocking issues. Please review.', 'system');
          return;
        }

        // Testing gate placeholder (real gates will be added later)
        kanban.updateTicketStatus(nextTicket.id, 'testing');
        kanban.updateTicketProgress(nextTicket.id, 98);

        // Blueprint coverage gate (static)
        try {
          const { validateBlueprint } = await import('@/lib/blueprint-validator');
          const bpResult = validateBlueprint(planBlueprint);
          if (!bpResult.ok) {
            throw new Error(`Blueprint validation failed: ${bpResult.errors.join('; ')}`);
          }
        } catch (e: any) {
          kanban.updateTicketStatus(nextTicket.id, 'failed', e.message || 'Blueprint validation failed');
          setKanbanBuildActive(false);
          setGenerationProgress(prev => ({ ...prev, isGenerating: false, status: `Failed: ${e.message}` }));
          addChatMessage(`Build failed: ${e.message}`, 'error');
          return;
        }

        // Mark ticket complete
        kanban.updateTicketStatus(nextTicket.id, 'done');
        kanban.updateTicketProgress(nextTicket.id, 100);

        if (gitSync.isEnabled && currentFiles.length > 0) {
          gitSync.syncTicketCompletion(
            {
              id: nextTicket.id,
              title: nextTicket.title,
              description: nextTicket.description,
              type: nextTicket.type,
              priority: nextTicket.priority,
            },
            currentFiles
          );
        }

        // In single-ticket mode, stop after completing one ticket.
        if (opts?.onlyTicketId) {
          break;
        }
      }

      setKanbanBuildActive(false);
      setGenerationProgress(prev => ({ ...prev, isGenerating: false, status: 'Build complete' }));
    } catch (error: any) {
      const message = error?.message || 'Build failed';
      const currentId = kanban.currentTicketId;
      if (currentId) {
        kanban.updateTicketStatus(currentId, 'failed', message);
      }
      setKanbanBuildActive(false);
      setGenerationProgress(prev => ({ ...prev, isGenerating: false, status: `Failed: ${message}` }));
      addChatMessage(`Build failed: ${message}`, 'error');
    }
  };

  const handleBuildSingleTicket = async (ticketId: string) => {
    if (kanbanBuildActive) {
      addChatMessage('A build is already running. Please wait for it to finish.', 'system');
      return;
    }
    await handleStartKanbanBuild({ onlyTicketId: ticketId });
  };

  // Auto-resume the build after a review approval (so users don't have to hit ▶ Start repeatedly).
  useEffect(() => {
    if (!resumeAfterReview) return;
    if (showCodeReview) return;
    if (kanbanBuildActive) {
      setResumeAfterReview(false);
      return;
    }
    if (kanban.isPaused) {
      setResumeAfterReview(false);
      return;
    }

    const hasBacklog = kanban.tickets.some(t => t.status === 'backlog');
    if (!hasBacklog) {
      setResumeAfterReview(false);
      return;
    }

    // Kick the loop again using the latest state (this effect runs after state updates).
    setResumeAfterReview(false);
    void handleStartKanbanBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAfterReview, showCodeReview, kanbanBuildActive, kanban.isPaused, kanban.tickets]);

  const handleCreateManualPlanSnapshot = async () => {
    const created = await planVersions.createSnapshot({
      source: 'manual',
      name: '💾 Plan snapshot',
      description: 'Manual snapshot',
      tickets: kanban.tickets,
      planIdOverride: kanban.plan?.id || null,
    });
    if (created) {
      addChatMessage(`📌 Saved plan snapshot: ${created.name}`, 'system');
    }
  };

  const handleRestorePlanSnapshot = async (version: PlanVersion) => {
    if (kanbanBuildActive) {
      addChatMessage('⏳ Cannot restore plan while build is running.', 'system');
      return;
    }

    const ok =
      typeof window !== 'undefined' &&
      window.confirm(`Restore snapshot "${version.name}"?\n\nThis will replace your current plan.`); // eslint-disable-line no-alert

    if (!ok) return;

    // Create a quick backup snapshot before restoring (local only if server isn't available)
    await planVersions.createSnapshot({
      source: 'manual',
      name: '💾 Backup (before restore)',
      description: `Backup before restoring "${version.name}"`,
      tickets: kanban.tickets,
      planIdOverride: kanban.plan?.id || null,
    });

    kanban.setTickets(version.tickets || []);
    if (kanban.plan) {
      kanban.setPlan({ ...kanban.plan, tickets: version.tickets || [], updatedAt: new Date() });
    }
    setActiveTab('kanban');
    addChatMessage(`🔁 Restored plan snapshot: ${version.name}`, 'system');
  };

  const renderRepoLoadModal = () => {
    if (!repoLoadModalOpen) return null;

    const titleRepo = lastImportedRepo ? `${lastImportedRepo.repoFullName}@${lastImportedRepo.branch}` : 'Imported repo';
    const canClose = repoLoadStatus !== 'running';
    const statusLabel =
      repoLoadStatus === 'running'
        ? 'Working…'
        : repoLoadStatus === 'success'
          ? 'Done'
          : repoLoadStatus === 'error'
            ? 'Failed'
            : 'Idle';

    const statusClass =
      repoLoadStatus === 'running'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : repoLoadStatus === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : repoLoadStatus === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-gray-50 text-gray-700 border-gray-200';

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">Loading repo into sandbox</div>
              <div className="text-xs text-gray-500 truncate">{titleRepo}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-full border ${statusClass}`}>{statusLabel}</span>
              <button
                onClick={() => canClose && setRepoLoadModalOpen(false)}
                disabled={!canClose}
                className={`h-8 w-8 rounded-md border flex items-center justify-center ${
                  canClose ? 'border-gray-200 hover:bg-gray-50 text-gray-700' : 'border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
                title={canClose ? 'Close' : 'Working…'}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-xs text-gray-600">
              This can take a couple minutes (especially during <span className="font-medium">npm install</span>).
            </div>
          </div>

          <div className="px-4 pb-3 space-y-2">
            {repoLoadSteps.length === 0 ? (
              <div className="text-xs text-gray-500">Preparing…</div>
            ) : (
              <div className="space-y-1.5">
                {repoLoadSteps.map(step => {
                  const icon =
                    step.status === 'done'
                      ? '✅'
                      : step.status === 'running'
                        ? '⏳'
                        : step.status === 'error'
                          ? '❌'
                          : '•';

                  const rowClass =
                    step.status === 'running'
                      ? 'border-blue-200 bg-blue-50'
                      : step.status === 'done'
                        ? 'border-green-200 bg-green-50'
                        : step.status === 'error'
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-white';

                  return (
                    <div key={step.id} className={`rounded-lg border px-3 py-2 ${rowClass}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-sm leading-5">{icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-gray-900">{step.label}</div>
                          {step.detail ? (
                            <div className="mt-0.5 text-[11px] text-gray-600 whitespace-pre-wrap break-words">
                              {step.detail}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {repoLoadStatus === 'error' && repoLoadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">
                {repoLoadError}
              </div>
            ) : null}

            {repoLoadLogs.length > 0 ? (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-gray-500 mb-1">Logs (tail)</div>
                <pre className="max-h-40 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-700 whitespace-pre-wrap break-words">
{repoLoadLogs.slice(-20).join('\n\n')}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              onClick={() => setRepoLoadModalOpen(false)}
              disabled={!canClose}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                canClose ? 'border-gray-200 hover:bg-gray-50 text-gray-700' : 'border-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const sandboxCreationRef = useRef<boolean>(false);

  const createSandbox = async (
    fromHomeScreen = false,
    retryCount = 0,
    template: 'vite' | 'next' = 'vite'
  ) => {
    const MAX_RETRIES = 3;

    // Prevent duplicate sandbox creation
    if (sandboxCreationRef.current) {
      console.log('[createSandbox] Sandbox creation already in progress, skipping...');
      return null;
    }

    sandboxCreationRef.current = true;
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus(retryCount > 0 ? `Retrying sandbox creation (${retryCount}/${MAX_RETRIES})...` : 'Creating sandbox...', false);
    setResponseArea([]);
    setScreenshotError(null);
    setSandboxRetryCount(retryCount);

    try {
      const response = await fetch('/api/create-ai-sandbox-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template })
      });

      const data = await response.json().catch(() => ({}));
      console.log('[createSandbox] Response data:', data);

      if (!response.ok) {
        const e: any = new Error(data?.error || `Failed to create sandbox (HTTP ${response.status})`);
        e.code = data?.code || (response.status === 429 ? 'RATE_LIMITED' : undefined);
        e.retryAfter = data?.retryAfter;
        throw e;
      }

      if (data.success) {
        sandboxCreationRef.current = false; // Reset the ref on success
        console.log('[createSandbox] Setting sandboxData from creation:', data);
        setSandboxData(data);
        updateStatus('Sandbox active', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);

        // Update URL with sandbox ID
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        newParams.set('model', aiModel);
        router.push(`/generation?${newParams.toString()}`, { scroll: false });

        // Fade out loading background after sandbox loads
        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);

        if (data.structure) {
          displayStructure(data.structure);
        }

        // Fetch sandbox files after creation
        setTimeout(fetchSandboxFiles, 1000);

        // For Vercel sandboxes, Vite is already started during setupViteApp
        // No need to restart it immediately after creation
        // Only restart if there's an actual issue later
        console.log('[createSandbox] Sandbox ready with Vite server running');

        // Only add welcome message if not coming from home screen
        if (!fromHomeScreen) {
          addChatMessage(`Sandbox created! ID: ${data.sandboxId}. I now have context of your sandbox and can help you build your app. Just ask me to create components and I'll automatically apply them!

Tip: I automatically detect and install npm packages from your code imports (like react-router-dom, axios, etc.)`, 'system');
        }

        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);

        // Return the sandbox data so it can be used immediately
        return data;
      } else {
        const e: any = new Error(data?.error || 'Unknown error');
        e.code = data?.code;
        throw e;
      }
    } catch (error: any) {
      console.error('[createSandbox] Error:', error);
      sandboxCreationRef.current = false; // Reset to allow retry

      const code = error?.code as string | undefined;
      const nonRetryable =
        code === 'SANDBOX_PROVIDER_NOT_CONFIGURED' ||
        code === 'USAGE_LIMIT_REACHED' ||
        code === 'RATE_LIMITED' ||
        /rate limit/i.test(error?.message || '');

      // Auto-retry on transient failure only
      if (!nonRetryable && retryCount < MAX_RETRIES) {
        console.log(`[createSandbox] Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        updateStatus(`Connection failed. Retrying (${retryCount + 1}/${MAX_RETRIES})...`, false);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return createSandbox(fromHomeScreen, retryCount + 1, template);
      }

      updateStatus('Error', false);
      log(`Failed to create sandbox after ${MAX_RETRIES} attempts: ${error.message}`, 'error');
      addChatMessage(`Failed to create sandbox: ${error.message}. Please try again.`, 'system');
      throw error;
    } finally {
      setLoading(false);
      sandboxCreationRef.current = false; // Reset the ref
    }
  };

  const displayStructure = (structure: any) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || 'No structure available');
    }
  };

  type ApplyGeneratedCodeOutcome = {
    success: boolean;
    results?: any;
    appliedFiles?: string[];
    error?: string;
  };

  const applyGeneratedCode = async (
    code: string,
    isEdit: boolean = false,
    overrideSandboxData?: SandboxData,
    opts?: { throwOnError?: boolean }
  ): Promise<ApplyGeneratedCodeOutcome> => {
    const throwOnError = Boolean(opts?.throwOnError);
    setLoading(true);
    log('Applying AI-generated code...');

    try {
      // Show progress component instead of individual messages
      setCodeApplicationState({ stage: 'analyzing' });

      // Get pending packages from tool calls
      const pendingPackages = ((window as any).pendingPackages || []).filter((pkg: any) => pkg && typeof pkg === 'string');
      if (pendingPackages.length > 0) {
        console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
        // Clear pending packages after use
        (window as any).pendingPackages = [];
      }

      // Use streaming endpoint for real-time feedback
      const effectiveSandboxData = overrideSandboxData || sandboxData;
      const response = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: effectiveSandboxData?.sandboxId // Pass the sandbox ID to ensure proper connection
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      let streamError: string | null = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'start':
                  // Don't add as chat message, just update state
                  setCodeApplicationState({ stage: 'analyzing' });
                  break;

                case 'step':
                  // Update progress state based on step
                  if (data.message.includes('Installing') && data.packages) {
                    setCodeApplicationState({
                      stage: 'installing',
                      packages: data.packages
                    });
                  } else if (data.message.includes('Creating files') || data.message.includes('Applying')) {
                    setCodeApplicationState({
                      stage: 'applying',
                      filesGenerated: [] // Files will be populated when complete
                    });
                  }
                  break;

                case 'package-progress':
                  // Handle package installation progress
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({
                      ...prev,
                      installedPackages: data.installedPackages
                    }));
                  }
                  break;

                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (data.command && !data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;

                case 'success':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({
                      ...prev,
                      installedPackages: data.installedPackages
                    }));
                  }
                  break;

                case 'file-progress':
                  // Skip file progress messages, they're noisy
                  break;

                case 'file-complete':
                  // Could add individual file completion messages if desired
                  break;

                case 'command-progress':
                  addChatMessage(`${data.action} command: ${data.command}`, 'command', { commandType: 'input' });
                  break;

                case 'command-output':
                  addChatMessage(data.output, 'command', {
                    commandType: data.stream === 'stderr' ? 'error' : 'output'
                  });
                  break;

                case 'command-complete':
                  if (data.success) {
                    addChatMessage(`Command completed successfully`, 'system');
                  } else {
                    addChatMessage(`Command failed with exit code ${data.exitCode}`, 'system');
                  }
                  break;

                case 'complete':
                  finalData = data;
                  setCodeApplicationState({ stage: 'complete' });
                  // Clear the state after a delay
                  setTimeout(() => {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  // Reset loading state when complete
                  setLoading(false);
                  break;

                case 'error':
                  addChatMessage(`Error: ${data.message || data.error || 'Unknown error'}`, 'system');
                  streamError = data.message || data.error || 'Unknown error';
                  // Reset loading state on error
                  setLoading(false);
                  break;

                case 'warning':
                  addChatMessage(`${data.message}`, 'system');
                  break;

                case 'info':
                  // Show info messages, especially for package installation
                  if (data.message) {
                    addChatMessage(data.message, 'system');
                  }
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }

      // Process final data
      if (finalData && finalData.type === 'complete') {
        const data: any = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message,
          autoCompleted: finalData.autoCompleted,
          autoCompletedComponents: finalData.autoCompletedComponents,
          warning: finalData.warning,
          missingImports: finalData.missingImports,
          debug: finalData.debug
        };

        const results = data.results || {};
        const appliedFiles = [
          ...(results.filesCreated || []),
          ...(results.filesUpdated || []),
        ];

        if (data.success) {

          // Log package installation results without duplicate messages
          if (results.packagesInstalled?.length > 0) {
            log(`Packages installed: ${results.packagesInstalled.join(', ')}`);
          }

          if (results.filesCreated?.length > 0) {
            log('Files created:');
            results.filesCreated.forEach((file: string) => {
              log(`  ${file}`, 'command');
            });

            // Verify files were actually created by refreshing the sandbox if needed
            if (sandboxData?.sandboxId && results.filesCreated.length > 0) {
              // Small delay to ensure files are written
              setTimeout(() => {
                // Force refresh the iframe to show new files
                if (iframeRef.current) {
                  iframeRef.current.src = iframeRef.current.src;
                }
              }, 1000);
            }
          }

          if (results.filesUpdated?.length > 0) {
            log('Files updated:');
            results.filesUpdated.forEach((file: string) => {
              log(`  ${file}`, 'command');
            });
          }

          // Update conversation context with applied code
          setConversationContext(prev => ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
              timestamp: new Date()
            }]
          }));

          if (results.commandsExecuted?.length > 0) {
            log('Commands executed:');
            results.commandsExecuted.forEach((cmd: string) => {
              log(`  $ ${cmd}`, 'command');
            });
          }

          if (results.errors?.length > 0) {
            results.errors.forEach((err: string) => {
              log(err, 'error');
            });
          }

          // In strict mode (used by Kanban builds/restores), treat any apply errors as blocking.
          if (throwOnError) {
            const fatal: string[] = [];
            if (results.errors?.length > 0) fatal.push(...results.errors);
            if (results.packagesFailed?.length > 0) {
              fatal.push(`Packages failed to install: ${results.packagesFailed.join(', ')}`);
            }
            if (fatal.length > 0) {
              throw new Error(fatal.slice(0, 3).join(' | '));
            }
          }

          if (data.structure) {
            displayStructure(data.structure);
          }

          if (data.explanation) {
            log(data.explanation);
          }

          if (data.autoCompleted) {
            log('Auto-generating missing components...', 'command');

            if (data.autoCompletedComponents) {
              setTimeout(() => {
                log('Auto-generated missing components:', 'info');
                data.autoCompletedComponents.forEach((comp: string) => {
                  log(`  ${comp}`, 'command');
                });
              }, 1000);
            }
          } else if (data.warning) {
            log(data.warning, 'error');

            if (data.missingImports && data.missingImports.length > 0) {
              const missingList = data.missingImports.join(', ');
              addChatMessage(
                `Ask me to "create the missing components: ${missingList}" to fix these import errors.`,
                'system'
              );
            }
          }

          log('Code applied successfully!');
          console.log('[applyGeneratedCode] Response data:', data);
          console.log('[applyGeneratedCode] Debug info:', data.debug);
          console.log('[applyGeneratedCode] Current sandboxData:', sandboxData);
          console.log('[applyGeneratedCode] Current iframe element:', iframeRef.current);
          console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current?.src);

          // Set applying code state for edits to show loading overlay
          // Removed overlay - changes apply directly

          if (results.filesCreated?.length > 0) {
            setConversationContext(prev => ({
              ...prev,
              appliedCode: [...prev.appliedCode, {
                files: results.filesCreated,
                timestamp: new Date()
              }]
            }));

            // Update the chat message to show success
            // Only show file list if not in edit mode
            if (isEdit) {
              addChatMessage(`Edit applied successfully!`, 'system');
            } else {
              // Check if this is part of a generation flow (has recent AI recreation message)
              const recentMessages = chatMessages.slice(-5);
              const isPartOfGeneration = recentMessages.some(m =>
                m.content.includes('AI recreation generated') ||
                m.content.includes('Code generated')
              );

              // Don't show files if part of generation flow to avoid duplication
              if (isPartOfGeneration) {
                addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, 'system');
              } else {
                addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, 'system', {
                  appliedFiles: results.filesCreated
                });
              }
            }

            // If there are failed packages, add a message about checking for errors
            if (results.packagesFailed?.length > 0) {
              addChatMessage(`⚠️ Some packages failed to install. Check the error banner above for details.`, 'system');
            }

            // Fetch updated file structure
            await fetchSandboxFiles();

            // Skip automatic package check - it's not needed here and can cause false "no sandbox" messages
            // Packages are already installed during the apply-ai-code-stream process

            // Test build to ensure everything compiles correctly
            // Skip build test for now - it's causing errors with undefined activeSandbox
            // The build test was trying to access global.activeSandbox from the frontend,
            // but that's only available in the backend API routes
            console.log('[build-test] Skipping build test - would need API endpoint');

            // Force iframe refresh after applying code
            const refreshDelay = appConfig.codeApplication.defaultRefreshDelay; // Allow Vite to process changes

            setTimeout(() => {
              const currentSandboxData = effectiveSandboxData;
              if (iframeRef.current && currentSandboxData?.url) {
                console.log('[home] Refreshing iframe after code application...');

                // Method 1: Change src with timestamp
                const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&applied=true`;
                iframeRef.current.src = urlWithTimestamp;

                // Method 2: Force reload after a short delay
                setTimeout(() => {
                  try {
                    if (iframeRef.current?.contentWindow) {
                      iframeRef.current.contentWindow.location.reload();
                      console.log('[home] Force reloaded iframe content');
                    }
                  } catch (e) {
                    console.log('[home] Could not reload iframe (cross-origin):', e);
                  }
                  // Reload completed
                }, 1000);
              }
            }, refreshDelay);

            // Vite error checking removed - handled by template setup
          }

          // Give Vite HMR a moment to detect changes, then ensure refresh
          const currentSandboxData = effectiveSandboxData;
          if (iframeRef.current && currentSandboxData?.url) {
            // Wait for Vite to process the file changes
            // If packages were installed, wait longer for Vite to restart
            const packagesInstalled = results?.packagesInstalled?.length > 0 || data.results?.packagesInstalled?.length > 0;
            const refreshDelay = packagesInstalled ? appConfig.codeApplication.packageInstallRefreshDelay : appConfig.codeApplication.defaultRefreshDelay;
            console.log(`[applyGeneratedCode] Packages installed: ${packagesInstalled}, refresh delay: ${refreshDelay}ms`);

            setIsPreviewRefreshing(true);
            setActiveTab('preview');
            
            setTimeout(async () => {
              if (iframeRef.current && currentSandboxData?.url) {
                console.log('[applyGeneratedCode] Starting iframe refresh sequence...');

                try {
                  const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&force=true`;
                  iframeRef.current.onload = () => {
                    console.log('[applyGeneratedCode] Iframe loaded successfully');
                    setIsPreviewRefreshing(false);
                  };
                  iframeRef.current.onerror = () => {
                    console.error('[applyGeneratedCode] Iframe load error');
                    setIsPreviewRefreshing(false);
                  };
                  iframeRef.current.src = urlWithTimestamp;
                  
                  // Fallback timeout to hide loading state
                  setTimeout(() => setIsPreviewRefreshing(false), 5000);
                } catch (e) {
                  console.error('[applyGeneratedCode] Refresh failed:', e);
                  setIsPreviewRefreshing(false);
                }
              } else {
                console.error('[applyGeneratedCode] No iframe or sandbox URL available');
                setIsPreviewRefreshing(false);
              }
            }, refreshDelay);
          }

        } else {
          throw new Error(finalData?.error || 'Failed to apply code');
        }

        return { success: true, results: data.results, appliedFiles };
      } else {
        const msg = 'No completion event received from code application stream.';
        addChatMessage('Code application may have partially succeeded. Check the preview.', 'system');
        if (throwOnError) {
          throw new Error(msg);
        }
        return { success: false, error: msg };
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, 'error');
      if (throwOnError) {
        throw error;
      }
      return { success: false, error: error?.message || 'Failed to apply code' };
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev => ({
        ...prev,
        isEdit: false
      }));
    }
  };

  const fetchSandboxFiles = async () => {
    if (!sandboxData) return;

    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  };

  const restartViteServer = async () => {
    try {
      addChatMessage('Restarting Vite dev server...', 'system');

      const response = await fetch('/api/restart-vite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          addChatMessage('Vite dev server restarted successfully!', 'system');

          setTimeout(() => {
            if (iframeRef.current && sandboxData?.url) {
              iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
            }
          }, 2000);
        } else {
          addChatMessage(`Failed to restart Vite: ${data.error}`, 'error');
        }
      } else {
        addChatMessage('Failed to restart Vite server', 'error');
      }
    } catch (error) {
      addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const applyCode = async () => {
    const code = promptInput.trim();
    if (!code) {
      addChatMessage('No code to apply. Please generate code first.', 'system');
      return;
    }

    if (loading) {
      return;
    }

    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(code, isEdit);
  };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
      return (
        /* Generation Tab Content */
        <div className="absolute inset-0 flex overflow-hidden">
          {/* File Explorer - Hide during edits */}
          {!generationProgress.isEdit && (
            <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
              <div className="p-4 bg-gray-100 text-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BsFolderFill style={{ width: '16px', height: '16px' }} />
                  <span className="text-sm font-medium">Explorer</span>
                </div>
              </div>

              {/* File Tree */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {/* Skeleton loader when generating but no files yet */}
                {generationProgress.isGenerating && generationProgress.files.length === 0 && (
                  <div className="space-y-2 animate-pulse">
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-4 h-4 bg-gray-200 rounded" />
                      <div className="w-4 h-4 bg-blue-100 rounded" />
                      <div className="w-16 h-3 bg-gray-200 rounded" />
                    </div>
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center gap-2 py-1">
                        <div className="w-4 h-4 bg-gray-200 rounded" />
                        <div className="w-4 h-4 bg-yellow-100 rounded" />
                        <div className="w-20 h-3 bg-gray-200 rounded" />
                      </div>
                      <div className="ml-6 space-y-1.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center gap-2 py-0.5 px-3">
                            <div className="w-4 h-4 bg-gray-100 rounded" />
                            <div className={`h-3 bg-gray-200 rounded`} style={{ width: `${60 + i * 15}px` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-sm">
                  {/* Root app folder */}
                  <div
                    className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                    onClick={() => toggleFolder('app')}
                  >
                    {expandedFolders.has('app') ? (
                      <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                    ) : (
                      <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                    )}
                    {expandedFolders.has('app') ? (
                      <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                    ) : (
                      <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                    )}
                    <span className="font-medium text-gray-800">app</span>
                  </div>

                  {expandedFolders.has('app') && (
                    <div className="ml-6">
                      {/* Group files by directory */}
                      {(() => {
                        const fileTree: { [key: string]: Array<{ name: string; edited?: boolean }> } = {};

                        // Create a map of edited files
                        // const editedFiles = new Set(
                        //   generationProgress.files
                        //     .filter(f => f.edited)
                        //     .map(f => f.path)
                        // );

                        // Process all files from generation progress
                        generationProgress.files.forEach(file => {
                          const parts = file.path.split('/');
                          const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                          const fileName = parts[parts.length - 1];

                          if (!fileTree[dir]) fileTree[dir] = [];
                          fileTree[dir].push({
                            name: fileName,
                            edited: file.edited || false
                          });
                        });

                        return Object.entries(fileTree).map(([dir, files]) => (
                          <div key={dir} className="mb-1">
                            {dir && (
                              <div
                                className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                                onClick={() => toggleFolder(dir)}
                              >
                                {expandedFolders.has(dir) ? (
                                  <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                                ) : (
                                  <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                                )}
                                {expandedFolders.has(dir) ? (
                                  <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                                ) : (
                                  <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                                )}
                                <span className="text-gray-700">{dir.split('/').pop()}</span>
                              </div>
                            )}
                            {(!dir || expandedFolders.has(dir)) && (
                              <div className={dir ? 'ml-8' : ''}>
                                {files.sort((a, b) => a.name.localeCompare(b.name)).map(fileInfo => {
                                  const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                  const isSelected = selectedFile === fullPath;

                                  return (
                                    <div
                                      key={fullPath}
                                      className={`flex items-center gap-2 py-0.5 px-3 rounded cursor-pointer transition-all ${isSelected
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      onClick={() => handleFileClick(fullPath)}
                                    >
                                      {getFileIcon(fileInfo.name)}
                                      <span className={`text-xs flex items-center gap-1 ${isSelected ? 'font-medium' : ''}`}>
                                        {fileInfo.name}
                                        {fileInfo.edited && (
                                          <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-blue-400' : 'bg-orange-500 text-white'
                                            }`}>✓</span>
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Code Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thinking Mode Display - Only show during active generation */}
            {generationProgress.isGenerating && (generationProgress.isThinking || generationProgress.thinkingText) && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-purple-600 font-medium flex items-center gap-2">
                    {generationProgress.isThinking ? (
                      <>
                        <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse" />
                        AI is thinking...
                      </>
                    ) : (
                      <>
                        <span className="text-purple-600">✓</span>
                        Thought for {generationProgress.thinkingDuration || 0} seconds
                      </>
                    )}
                  </div>
                </div>
                {generationProgress.thinkingText && (
                  <div className="bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide">
                    <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                      {generationProgress.thinkingText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Live Code Display */}
            <div className="flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide" ref={codeDisplayRef}>
                {/* Show selected file if one is selected */}
                {selectedFile ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(selectedFile)}
                          <span className="font-mono text-sm">{selectedFile}</span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="hover:bg-black/20 p-1 rounded transition-colors"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="bg-gray-900 border border-gray-700 rounded">
                        <SyntaxHighlighter
                          language={(() => {
                            const ext = selectedFile.split('.').pop()?.toLowerCase();
                            if (ext === 'css') return 'css';
                            if (ext === 'json') return 'json';
                            if (ext === 'html') return 'html';
                            return 'jsx';
                          })()}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {(() => {
                            // Find the file content from generated files
                            const file = generationProgress.files.find(f => f.path === selectedFile);
                            return file?.content || '// File content will appear here';
                          })()}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                ) : /* If no files parsed yet, show loading or raw stream */
                  generationProgress.files.length === 0 && !generationProgress.currentFile ? (
                    generationProgress.isThinking ? (
                      // Beautiful loading state while thinking
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="mb-4 relative">
                            <div className="w-12 h-12 mx-auto">
                              <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
                              <div className="absolute inset-0 border-4 border-green-500 rounded-full animate-spin border-t-transparent"></div>
                            </div>
                          </div>
                          <h3 className="text-xl font-medium text-white mb-2">AI is analyzing your request</h3>
                          <p className="text-gray-400 text-sm">{generationProgress.status || 'Preparing to generate code...'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100 text-gray-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-16 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">Streaming code...</span>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-900 rounded">
                          <SyntaxHighlighter
                            language="jsx"
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.875rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                          >
                            {generationProgress.streamedCode || 'Starting code generation...'}
                          </SyntaxHighlighter>
                          <span className="inline-block w-3 h-5 bg-orange-400 ml-1 animate-pulse" />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {/* Show current file being generated */}
                      {generationProgress.currentFile && (
                        <div className="bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="font-mono text-sm">{generationProgress.currentFile.path}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${generationProgress.currentFile.type === 'css' ? 'bg-blue-600 text-white' :
                                generationProgress.currentFile.type === 'javascript' ? 'bg-yellow-600 text-white' :
                                  generationProgress.currentFile.type === 'json' ? 'bg-green-600 text-white' :
                                    'bg-gray-200 text-gray-700'
                                }`}>
                                {generationProgress.currentFile.type === 'javascript' ? 'JSX' : generationProgress.currentFile.type.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="bg-gray-900 border border-gray-700 rounded">
                            <SyntaxHighlighter
                              language={
                                generationProgress.currentFile.type === 'css' ? 'css' :
                                  generationProgress.currentFile.type === 'json' ? 'json' :
                                    generationProgress.currentFile.type === 'html' ? 'html' :
                                      'jsx'
                              }
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={true}
                            >
                              {generationProgress.currentFile.content}
                            </SyntaxHighlighter>
                            <span className="inline-block w-3 h-4 bg-orange-400 ml-4 mb-4 animate-pulse" />
                          </div>
                        </div>
                      )}

                      {/* Show completed files */}
                      {generationProgress.files.map((file, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <span className="font-mono text-sm">{file.path}</span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${file.type === 'css' ? 'bg-blue-600 text-white' :
                              file.type === 'javascript' ? 'bg-yellow-600 text-white' :
                                file.type === 'json' ? 'bg-green-600 text-white' :
                                  'bg-gray-200 text-gray-700'
                              }`}>
                              {file.type === 'javascript' ? 'JSX' : file.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="bg-gray-900 border border-gray-700  max-h-48 overflow-y-auto scrollbar-hide">
                            <SyntaxHighlighter
                              language={
                                file.type === 'css' ? 'css' :
                                  file.type === 'json' ? 'json' :
                                    file.type === 'html' ? 'html' :
                                      'jsx'
                              }
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={true}
                              wrapLongLines={true}
                            >
                              {file.content}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      ))}

                      {/* Show remaining raw stream if there's content after the last file */}
                      {!generationProgress.currentFile && generationProgress.streamedCode.length > 0 && (
                        <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-16 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              <span className="font-mono text-sm">Processing...</span>
                            </div>
                          </div>
                          <div className="bg-gray-900 border border-gray-700 rounded">
                            <SyntaxHighlighter
                              language="jsx"
                              style={vscDarkPlus}
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.75rem',
                                background: 'transparent',
                              }}
                              showLineNumbers={false}
                            >
                              {(() => {
                                // Show only the tail of the stream after the last file
                                const lastFileEnd = generationProgress.files.length > 0
                                  ? generationProgress.streamedCode.lastIndexOf('</file>') + 7
                                  : 0;
                                let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();

                                // Remove explanation tags and content
                                remainingContent = remainingContent.replace(/<explanation>[\s\S]*?<\/explanation>/g, '').trim();

                                // If only whitespace or nothing left, show loading message
                                // Use "Loading sandbox..." instead of "Waiting for next file..." for better UX
                                return remainingContent || 'Loading sandbox...';
                              })()}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>

            {/* Progress indicator */}
            {generationProgress.components.length > 0 && (
              <div className="mx-6 mb-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                    style={{
                      width: `${(generationProgress.currentComponent / Math.max(generationProgress.components.length, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'preview') {
      // Show loading state for initial generation or when starting a new generation with existing sandbox
      const isInitialGeneration = !sandboxData?.url && (urlScreenshot || isCapturingScreenshot || isPreparingDesign || loadingStage);
      const isNewGenerationWithSandbox = isStartingNewGeneration && sandboxData?.url;
      const shouldShowLoadingOverlay = (isInitialGeneration || isNewGenerationWithSandbox) &&
        (loading || generationProgress.isGenerating || isPreparingDesign || loadingStage || isCapturingScreenshot || isStartingNewGeneration);

      if (isInitialGeneration || isNewGenerationWithSandbox) {
        return (
          <div className="relative w-full h-full bg-gray-900">
            {/* Screenshot as background when available */}
            {urlScreenshot && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={urlScreenshot}
                alt="Website preview"
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{
                  opacity: isScreenshotLoaded ? 1 : 0,
                  willChange: 'opacity'
                }}
                onLoad={() => setIsScreenshotLoaded(true)}
                loading="eager"
              />
            )}

            {/* Loading overlay - only show when actively processing initial generation */}
            {shouldShowLoadingOverlay && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                {/* Loading animation with skeleton */}
                <div className="text-center max-w-md">
                  {/* Animated skeleton lines */}
                  <div className="mb-6 space-y-3">
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse"
                      style={{ animationDuration: '1.5s', animationDelay: '0s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto"
                      style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto"
                      style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  </div>

                  {/* Status text */}
                  <p className="text-white text-lg font-medium">
                    {isCapturingScreenshot ? 'Analyzing website...' :
                      isPreparingDesign ? 'Preparing design...' :
                        generationProgress.isGenerating ? 'Generating code...' :
                          'Loading...'}
                  </p>

                  {/* Subtle progress hint */}
                  <p className="text-white/60 text-sm mt-2">
                    {isCapturingScreenshot ? 'Taking a screenshot of the site' :
                      isPreparingDesign ? 'Understanding the layout and structure' :
                        generationProgress.isGenerating ? 'Writing React components' :
                          'Please wait...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }

      // Show sandbox iframe - keep showing during edits, only hide during initial loading
      if (sandboxData?.url) {
        const deviceStyles = {
          desktop: { width: '100%', maxWidth: '100%' },
          tablet: { width: '768px', maxWidth: '768px' },
          mobile: { width: '375px', maxWidth: '375px' }
        };

        return (
          <div className="relative w-full h-full flex items-center justify-center bg-gray-100">
            <div
              className={`h-full transition-all duration-300 ${previewDevice !== 'desktop' ? 'shadow-2xl rounded-lg overflow-hidden border border-gray-300' : ''}`}
              style={deviceStyles[previewDevice]}
            >
              <iframe
                ref={iframeRef}
                src={sandboxData.url}
                className="w-full h-full border-none bg-white"
                title="Paynto A.I. Sandbox"
                allow="clipboard-write"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            </div>

            {/* Sandbox expired overlay */}
            {sandboxExpired && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-30">
                <div className="text-center max-w-md p-6">
                  <div className="w-16 h-16 mx-auto mb-4 text-orange-500">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sandbox Expired</h3>
                  <p className="text-sm text-gray-600 mb-4">The sandbox session has timed out. Creating a new one...</p>
                  <div className="w-8 h-8 mx-auto border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            )}

            {/* Preview refreshing overlay */}
            {isPreviewRefreshing && !sandboxExpired && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-3 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Updating preview...</p>
                </div>
              </div>
            )}

            {/* Package installation overlay - shows when installing packages or applying code */}
            {codeApplicationState.stage && codeApplicationState.stage !== 'complete' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center max-w-md">
                  <div className="mb-6">
                    {/* Animated icon based on stage */}
                    {codeApplicationState.stage === 'installing' ? (
                      <div className="w-16 h-16 mx-auto">
                        <svg className="w-full h-full animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : null}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {codeApplicationState.stage === 'analyzing' && 'Analyzing code...'}
                    {codeApplicationState.stage === 'installing' && 'Installing packages...'}
                    {codeApplicationState.stage === 'applying' && 'Applying changes...'}
                  </h3>

                  {/* Package list during installation */}
                  {codeApplicationState.stage === 'installing' && codeApplicationState.packages && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {codeApplicationState.packages.map((pkg, index) => (
                          <span
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full transition-all ${codeApplicationState.installedPackages?.includes(pkg)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                              }`}
                          >
                            {pkg}
                            {codeApplicationState.installedPackages?.includes(pkg) && (
                              <span className="ml-1">✓</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files being generated */}
                  {codeApplicationState.stage === 'applying' && codeApplicationState.filesGenerated && (
                    <div className="text-sm text-gray-600">
                      Creating {codeApplicationState.filesGenerated.length} files...
                    </div>
                  )}

                  <p className="text-sm text-gray-500 mt-2">
                    {codeApplicationState.stage === 'analyzing' && 'Parsing generated code and detecting dependencies...'}
                    {codeApplicationState.stage === 'installing' && 'This may take a moment while npm installs the required packages...'}
                    {codeApplicationState.stage === 'applying' && 'Writing files to your sandbox environment...'}
                  </p>
                </div>
              </div>
            )}

            {/* Show a subtle indicator when code is being edited/generated */}
            {generationProgress.isGenerating && generationProgress.isEdit && !codeApplicationState.stage && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Generating code...</span>
              </div>
            )}

            {/* Preview controls */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              {sandboxData &&
              kanban.plan?.blueprint &&
              (kanban.tickets || []).some(t =>
                Boolean(t.generatedCode) && ['done', 'testing', 'pr_review', 'applying', 'generating'].includes(t.status)
              ) ? (
                <button
                  onClick={() => restoreKanbanPlanToSandbox(undefined, 'manual')}
                  disabled={isRestoringSandbox}
                  className={`bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 ${
                    isRestoringSandbox ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''
                  }`}
                  title={isRestoringSandbox ? 'Restoring…' : 'Restore build into this sandbox'}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6l4 2m6-2a10 10 0 11-3.2-7.3"
                    />
                  </svg>
                </button>
              ) : null}
              <button
                disabled={isRestoringSandbox}
                onClick={async () => {
                  if (!sandboxData?.sandboxId) return;

                  // If the sandbox expired while idle, recreate it instead of just reloading the iframe.
                  try {
                    const res = await fetch('/api/sandbox-status');
                    const data = await res.json().catch(() => null);
                    if (data?.sandboxStopped || !data?.active || data?.sandboxData?.healthStatusCode === 410) {
                      console.log('[Manual Refresh] Sandbox stopped - recreating...');
                      await checkSandboxStatus((sandboxData as any)?.templateTarget || 'vite');
                      return;
                    }
                  } catch (e) {
                    console.warn('[Manual Refresh] Sandbox status check failed:', e);
                  }

                  if (iframeRef.current && sandboxData?.url) {
                    console.log('[Manual Refresh] Forcing iframe reload...');
                    const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
                    iframeRef.current.src = newSrc;
                  }
                }}
                className={`bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105 ${
                  isRestoringSandbox ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''
                }`}
                title={isRestoringSandbox ? 'Restoring…' : 'Refresh sandbox'}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>
          </div>
        );
      }

      // Default state when no sandbox and no screenshot
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg">
          {screenshotError ? (
            <div className="text-center">
              <p className="mb-2">Failed to capture screenshot</p>
              <p className="text-sm text-gray-500">{screenshotError}</p>
            </div>
          ) : sandboxData ? (
            <div className="text-gray-500">
              <div className="w-16 h-16 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading preview...</p>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-sm">Start chatting to create your first app</p>
            </div>
          )}
        </div>
      );
    } else if (activeTab === 'kanban') {
      return (
        <KanbanBoard
          plan={kanban.plan}
          ticketsByColumn={kanban.getTicketsByColumn()}
          analytics={kanban.getAnalytics()}
          currentTicketId={kanban.currentTicketId}
          isBuilding={kanbanBuildActive}
          isPaused={kanban.isPaused}
          isPlanning={isPlanning}
          onPlanBuild={planBuild}
          onStartBuild={handleStartKanbanBuild}
          onPauseBuild={() => kanban.setIsPaused(true)}
          onResumeBuild={() => {
            kanban.setIsPaused(false);
            handleStartKanbanBuild();
          }}
          onEditTicket={kanban.editTicket}
          onSkipTicket={kanban.skipTicket}
          onRetryTicket={kanban.retryTicket}
          onDeleteTicket={kanban.deleteTicket}
          onRestoreTicket={kanban.restoreTicket}
          onMoveTicket={handleMoveTicket}
          onReorderTicket={kanban.reorderTicket}
          onAddTicket={kanban.addTicket}
          onSubmitInput={kanban.submitTicketInput}
          onBuildSingleTicket={handleBuildSingleTicket}
          onSetBuildMode={kanban.setBuildMode}
          buildMode={kanban.buildMode}
          tickets={kanban.tickets}
          previewUrl={sandboxData?.url}
          chatMessages={chatMessages}
          chatInput={aiChatInput}
          setChatInput={setAiChatInput}
          onSendMessage={sendChatMessage}
        />
      );
    } else if (activeTab === 'split') {
      return (
        <div className="flex h-full">
          <div className="w-1/2 border-r border-zinc-800 overflow-hidden">
            <KanbanBoard
              plan={kanban.plan}
              ticketsByColumn={kanban.getTicketsByColumn()}
              analytics={kanban.getAnalytics()}
              currentTicketId={kanban.currentTicketId}
              isBuilding={kanbanBuildActive}
              isPaused={kanban.isPaused}
              isPlanning={isPlanning}
              onPlanBuild={planBuild}
              onStartBuild={handleStartKanbanBuild}
              onPauseBuild={() => kanban.setIsPaused(true)}
              onResumeBuild={() => {
                kanban.setIsPaused(false);
                handleStartKanbanBuild();
              }}
              onEditTicket={kanban.editTicket}
              onSkipTicket={kanban.skipTicket}
              onRetryTicket={kanban.retryTicket}
              onDeleteTicket={kanban.deleteTicket}
              onRestoreTicket={kanban.restoreTicket}
              onMoveTicket={handleMoveTicket}
              onReorderTicket={kanban.reorderTicket}
              onAddTicket={kanban.addTicket}
              onSubmitInput={kanban.submitTicketInput}
              onBuildSingleTicket={handleBuildSingleTicket}
              onSetBuildMode={kanban.setBuildMode}
              buildMode={kanban.buildMode}
              tickets={kanban.tickets}
              previewUrl={sandboxData?.url}
              chatMessages={chatMessages}
              chatInput={aiChatInput}
              setChatInput={setAiChatInput}
              onSendMessage={sendChatMessage}
            />
          </div>
          <div className="w-1/2 bg-zinc-900 overflow-hidden">
            {sandboxData?.url ? (
              <div className="relative w-full h-full">
                <iframe
                  ref={iframeRef}
                  key={`split-preview-${sandboxData.sandboxId}`}
                  src={sandboxData.url}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                  title="Split Preview"
                />
                {isPreviewRefreshing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-white bg-zinc-800 px-4 py-2 rounded-lg">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm">Refreshing...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const sendChatMessage = async () => {
    const message = aiChatInput.trim();
    if (!message) return;

    if (!aiEnabled) {
      addChatMessage('AI is disabled. Please enable it first.', 'system');
      return;
    }

    addChatMessage(message, 'user');
    setAiChatInput('');

    // Check for special commands
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === 'check packages' || lowerMessage === 'install packages' || lowerMessage === 'npm install') {
      if (!sandboxData) {
        // More helpful message - user might be trying to run this too early
        addChatMessage('The sandbox is still being set up. Please wait for the generation to complete, then try again.', 'system');
        return;
      }
      await checkAndInstallPackages();
      return;
    }

    // Start sandbox creation in parallel if needed
    let sandboxPromise: Promise<void> | null = null;
    let sandboxCreating = false;

    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage('Creating sandbox while I plan your app...', 'system');
      sandboxPromise = createSandbox(true).catch((error: any) => {
        addChatMessage(`Failed to create sandbox: ${error.message}`, 'system');
        throw error;
      });
    }

    // Determine if this is an edit
    const isEdit = conversationContext.appliedCode.length > 0;

    try {
      // Generation tab is already active from scraping phase
      setGenerationProgress(prev => ({
        ...prev,  // Preserve all existing state
        isGenerating: true,
        status: 'Starting AI generation...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: true,
        thinkingText: 'Analyzing your request...',
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        // Add isEdit flag to generation progress
        isEdit: isEdit,
        // Keep existing files for edits - we'll mark edited ones differently
        files: prev.files
      }));

      // Backend now manages file state - no need to fetch from frontend
      console.log('[chat] Using backend file cache for context');

      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? 'pending' : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating
      };

      // Debug what we're sending
      console.log('[chat] Sending context to AI:');
      console.log('[chat] - sandboxId:', fullContext.sandboxId);
      console.log('[chat] - isEdit:', conversationContext.appliedCode.length > 0);

      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          model: aiModel,
          context: fullContext,
          isEdit: conversationContext.appliedCode.length > 0
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';
      let buffer = ''; // Buffer for incomplete lines

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          console.log('[chat] Received chunk:', chunk.length, 'bytes');
          buffer += chunk;
          const lines = buffer.split('\n');

          // Keep the last line in buffer if it's incomplete
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';

                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    // Let Build Tracker Agent handle ticket creation (clone mode)
                    buildTracker.processStreamedCode(newStreamedCode);

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        updatedState.currentFile = {
                          path: filePath,
                          content: partialContent,
                          type: fileType
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: 'Generated App.jsx structure'
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, {
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'package') {
                  // Handle package installation from tool calls
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));

                  // Clear thinking state when generation completes
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));

                  // Store packages to install from tool calls
                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[generate-code] Packages to install from tools:', data.packagesToInstall);
                    // Store packages globally for later installation
                    (window as any).pendingPackages = data.packagesToInstall;
                  }

                  // Parse all files from the completed code if not already done
                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles: Array<{ path: string; content: string; type: string; completed: boolean }> = [];
                  let fileMatch;

                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                      fileExt === 'css' ? 'css' :
                        fileExt === 'json' ? 'json' :
                          fileExt === 'html' ? 'html' : 'text';

                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }

                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''}!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    // Keep the files that were already parsed during streaming
                    files: prev.files.length > 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }

      if (generatedCode) {
        // Parse files from generated code for metadata
        const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }

        // Show appropriate message based on edit mode
        if (isEdit && generatedFiles.length > 0) {
          // For edits, show which file(s) were edited
          const editedFileNames = generatedFiles.map(f => f.split('/').pop()).join(', ');
          addChatMessage(
            explanation || `Updated ${editedFileNames}`,
            'ai',
            {
              appliedFiles: [generatedFiles[0]] // Only show the first edited file
            }
          );
        } else {
          // For new generation, show all files
          addChatMessage(explanation || 'Code generated!', 'ai', {
            appliedFiles: generatedFiles
          });
        }

        setPromptInput(generatedCode);
        // Don't show the Generated Code panel by default
        // setLeftPanelVisible(true);

        // Wait for sandbox creation if it's still in progress
        let activeSandboxData = sandboxData;
        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            const newSandboxData = await sandboxPromise;
            if (newSandboxData != null) {
              activeSandboxData = newSandboxData;
              // Also update the state for future use
              setSandboxData(newSandboxData);
            }
            // Remove the waiting message
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
          } catch (sandboxError) {
            console.error('[sendChatMessage] Sandbox creation failed:', sandboxError);
            addChatMessage('Sandbox creation failed. Cannot apply code.', 'error');
            return;
          }
        }

        if (activeSandboxData && generatedCode) {
          // For new sandbox creations (especially Vercel), add a delay to ensure Vite is ready
          if (sandboxCreating) {
            console.log('[startGeneration] New sandbox created, waiting for services to be ready...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Use isEdit flag that was determined at the start
          // Pass the sandbox data from the promise if it's different from the state
          await applyGeneratedCode(generatedCode, isEdit, activeSandboxData !== sandboxData ? activeSandboxData : undefined);
        }
      }

      // Show completion status briefly then switch to preview
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit,
        // Clear thinking state on completion
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined
      }));

      setTimeout(() => {
        // Switch to preview but keep files for display
        setActiveTab('preview');
      }, 1000); // Reduced from 3000ms to 1000ms
    } catch (error: any) {
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Thinking...'));
      addChatMessage(`Error: ${error.message}`, 'system');
      // Reset generation progress and switch back to preview on error
      setGenerationProgress({
        isGenerating: false,
        status: '',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0
      });
      setActiveTab('preview');
    }
  };


  const downloadZip = async () => {
    if (!sandboxData) {
      addChatMessage('Please wait for the sandbox to be created before downloading.', 'system');
      return;
    }

    setLoading(true);
    log('Creating zip file...');
    addChatMessage('Creating ZIP file of your Vite app...', 'system');

    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        log('Zip file created!');
        addChatMessage('ZIP file created! Download starting...', 'system');

        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addChatMessage(
          'Your Vite app has been downloaded! To run it locally:\n' +
          '1. Unzip the file\n' +
          '2. Run: npm install\n' +
          '3. Run: npm run dev\n' +
          '4. Open http://localhost:5173',
          'system'
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      log(`Failed to create zip: ${error.message}`, 'error');
      addChatMessage(`Failed to create ZIP: ${error.message}`, 'system');
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () => {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage('No previous generation to re-apply', 'system');
      return;
    }

    if (!sandboxData) {
      addChatMessage('Please create a sandbox first', 'system');
      return;
    }

    addChatMessage('Re-applying last generation...', 'system');
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };

  // Auto-scroll code display to bottom when streaming
  useEffect(() => {
    if (codeDisplayRef.current && generationProgress.isStreaming) {
      codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath: string) => {
    setSelectedFile(filePath);
    if (sandboxFiles[filePath]) {
      return;
    }
    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.files) {
          setSandboxFiles(data.files);
        }
      }
    } catch (error) {
      // File fetch failed silently - content will show from cache if available
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'jsx' || ext === 'js') {
      return <SiJavascript style={{ width: '16px', height: '16px' }} className="text-yellow-500" />;
    } else if (ext === 'tsx' || ext === 'ts') {
      return <SiReact style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'css') {
      return <SiCss3 style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'json') {
      return <SiJson style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    } else {
      return <FiFile style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    }
  };

  const clearChatHistory = () => {
    setChatMessages([{
      content: 'Chat history cleared. How can I help you?',
      type: 'system',
      timestamp: new Date()
    }]);
  };

  const cloneWebsite = async () => {
    let url = urlInput.trim();
    if (!url) {
      setUrlStatus(prev => [...prev, 'Please enter a URL']);
      return;
    }

    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    setUrlStatus([`Using: ${url}`, 'Starting to scrape...']);

    setUrlOverlayVisible(false);

    const cleanUrl = url.replace(/^https?:\/\//i, '');
    addChatMessage(`Starting to clone ${cleanUrl}...`, 'system');

    captureUrlScreenshot(url);

    try {
      addChatMessage('Scraping website content...', 'system');
      const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!scrapeResponse.ok) {
        throw new Error(`Scraping failed: ${scrapeResponse.status}`);
      }

      const scrapeData = await scrapeResponse.json();

      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Failed to scrape website');
      }

      addChatMessage(`Scraped ${scrapeData.content.length} characters from ${url}`, 'system');

      setIsPreparingDesign(false);
      setActiveTab('generation');

      setConversationContext(prev => ({
        ...prev,
        scrapedWebsites: [...prev.scrapedWebsites, {
          url,
          content: scrapeData,
          timestamp: new Date()
        }],
        currentProject: `Clone of ${url}`
      }));

      let sandboxPromise: Promise<any> | null = null;
      if (!sandboxData) {
        addChatMessage('Creating sandbox while generating your React app...', 'system');
        sandboxPromise = createSandbox(true);
      }

      addChatMessage('Analyzing and generating React recreation...', 'system');

      const recreatePrompt = `I scraped this website and want you to recreate it as a modern React application.

URL: ${url}

SCRAPED CONTENT:
${scrapeData.content}

${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${homeContextInput}

Please incorporate these requirements into the design and implementation.` : ''}

REQUIREMENTS:
1. Create a COMPLETE React application with App.jsx as the main component
2. App.jsx MUST import and render all other components
3. Recreate the main sections and layout from the scraped content
4. ${homeContextInput ? `Apply the user's context/theme: "${homeContextInput}"` : `Use a modern dark theme with excellent contrast:
   - Background: #0a0a0a
   - Text: #ffffff
   - Links: #60a5fa
   - Accent: #3b82f6`}
5. Make it fully responsive
6. Include hover effects and smooth transitions
7. Create separate components for major sections (Header, Hero, Features, etc.)
8. Use semantic HTML5 elements

IMPORTANT CONSTRAINTS:
- DO NOT use React Router or any routing libraries
- Use regular <a> tags with href="#section" for navigation, NOT Link or NavLink components
- This is a single-page application, no routing needed
- ALWAYS create src/App.jsx that imports ALL components
- Each component should be in src/components/
- Use Tailwind CSS for ALL styling (no custom CSS files)
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports

IMAGE HANDLING RULES:
- When the scraped content includes images, USE THE ORIGINAL IMAGE URLS whenever appropriate
- Keep existing images from the scraped site (logos, product images, hero images, icons, etc.)
- Use the actual image URLs provided in the scraped content, not placeholders
- Only use placeholder images or generic services when no real images are available
- For company logos and brand images, ALWAYS use the original URLs to maintain brand identity
- If scraped data contains image URLs, include them in your img tags
- Example: If you see "https://example.com/logo.png" in the scraped content, use that exact URL

Focus on the key sections and content, making it clean and modern while preserving visual assets.`;

      setGenerationProgress(prev => ({
        isGenerating: true,
        status: 'Initializing AI...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: true,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: prev.files || [],
        currentFile: undefined,
        lastProcessedPosition: 0
      }));

      setActiveTab('generation');

      const aiResponse = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: recreatePrompt,
          model: aiModel,
          context: {
            sandboxId: sandboxData?.sandboxId,
            structure: structureContent,
            conversationContext: conversationContext
          }
        })
      });

      if (!aiResponse.ok) {
        throw new Error(`AI generation failed: ${aiResponse.status}`);
      }

      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';

                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => ({
                    ...prev,
                    streamedCode: prev.streamedCode + data.text,
                    lastProcessedPosition: prev.lastProcessedPosition || 0
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, {
                      name: data.name,
                      path: data.path,
                      completed: true
                    }],
                    currentComponent: prev.currentComponent + 1
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                // Parse error - continue processing
              }
            }
          }
        }
      }

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit
      }));

      if (generatedCode) {
        addChatMessage('AI recreation generated!', 'system');

        if (explanation && explanation.trim()) {
          addChatMessage(explanation, 'ai');
        }

        setPromptInput(generatedCode);

        let activeSandboxData = sandboxData;
        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            const newSandboxData = await sandboxPromise;
            if (newSandboxData) {
              activeSandboxData = newSandboxData;
            }
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
          } catch (error: any) {
            addChatMessage('Sandbox creation failed. Cannot apply code.', 'system');
            throw error;
          }
        }

        if (activeSandboxData) {
          await applyGeneratedCode(generatedCode, false);
        }

        addChatMessage(
          `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`,
          'ai',
          {
            scrapedUrl: url,
            scrapedContent: scrapeData,
            generatedCode: generatedCode
          }
        );

        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null);
        setShowLoadingBackground(false);

        setTimeout(() => {
          setActiveTab('preview');
        }, 1000);
      } else {
        throw new Error('Failed to generate recreation');
      }

    } catch (error: any) {
      addChatMessage(`Failed to clone website: ${error.message}`, 'system');
      setUrlStatus([]);
      setIsPreparingDesign(false);
      setUrlScreenshot(null);
      setTargetUrl('');
      setScreenshotError(null);
      setLoadingStage(null);
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: '',
        files: prev.files
      }));
      setActiveTab('preview');
    }
  };

  const captureUrlScreenshot = async (url: string) => {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (data.success && data.screenshot) {
        setIsScreenshotLoaded(false); // Reset loaded state for new screenshot
        setUrlScreenshot(data.screenshot);
        // Set preparing design state
        setIsPreparingDesign(true);
        // Store the clean URL for display
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        // Switch to preview tab to show the screenshot
        if (activeTab !== 'preview') {
          setActiveTab('preview');
        }
      } else {
        setScreenshotError(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Start generation from a text prompt (no URL scraping)
  const startPromptGeneration = async (promptText: string) => {
    if (!promptText.trim()) return;

    setHomeScreenFading(true);
    setIsStartingNewGeneration(true);
    setLoadingStage('planning');
    setActiveTab('kanban');
    setShowLoadingBackground(true);

    setChatMessages([]);
    const shortPrompt = promptText.length > 50 ? promptText.substring(0, 50) + '...' : promptText;
    addChatMessage(`Building: ${shortPrompt}`, 'system');

    // Initialize Build Tracker Agent - it will create and manage tickets
    kanban.setTickets([]);
    const mainTicketId = buildTracker.startBuild(shortPrompt);
    kanban.setCurrentTicketId(mainTicketId);
    setKanbanBuildActive(true);

    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);

      setTimeout(() => {
        setIsStartingNewGeneration(false);
      }, 1000);

      // Create sandbox if needed
      let currentSandboxData = sandboxData;
      if (!currentSandboxData) {
        currentSandboxData = await createSandbox(true);
      }

      setLoadingStage('generating');
      setActiveTab('generation');

      // Build the prompt for AI
      const prompt = `Create a complete React application based on this description:

${promptText}

Requirements:
- Modern, responsive design using Tailwind CSS
- Clean component structure with proper file organization  
- Professional UI/UX with hover states and smooth transitions
- Use realistic placeholder content (not lorem ipsum)
- Include all necessary components mentioned or implied
- Use placeholder images from picsum.photos when needed

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports`;

      try {
        // Update conversation context
        setConversationContext(prev => ({
          ...prev,
          currentProject: `Build from prompt: ${shortPrompt}`
        }));

        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Initializing AI...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));

        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: aiModel,
            context: {
              sandboxId: currentSandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext
            },
            mode: 'prompt'
          })
        });

        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error('Failed to generate code');
        }

        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  let text = data.text || '';
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    // Let Build Tracker Agent handle ticket creation for files
                    buildTracker.processStreamedCode(newStreamedCode);

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        updatedState.files = [...updatedState.files, {
                          path: filePath,
                          content: fileContent.trim(),
                          type: fileType,
                          completed: true,
                          edited: false
                        }];

                        updatedState.status = `Completed ${filePath}`;
                        processedFiles.add(filePath);
                      }
                    }

                    return updatedState;
                  });
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;

                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                // Parsing error, skip
              }
            }
          }
        }

        // Apply the generated code
        if (generatedCode) {
          addChatMessage('Applying generated code to sandbox...', 'system');

          // Tell Build Tracker Agent we're applying
          buildTracker.markApplying();

          const applyResponse = await fetch('/api/apply-ai-code-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              response: generatedCode,
              sandboxId: currentSandboxData?.sandboxId,
              isEdit: false
            })
          });

          if (applyResponse.ok) {
            addChatMessage('Code applied successfully!', 'system');
            setConversationContext(prev => ({
              ...prev,
              appliedCode: [...prev.appliedCode, { files: [], timestamp: new Date() }]
            }));

            // Tell Build Tracker Agent build is complete
            buildTracker.markCompleted();
          }
        }

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Complete'
        }));
        setKanbanBuildActive(false);
        setActiveTab('preview');

      } catch (error) {
        console.error('[generation] Error in prompt generation:', error);
        addChatMessage(`Error: ${(error as Error).message}`, 'error');
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Error'
        }));

        // Tell Build Tracker Agent build failed
        buildTracker.markFailed((error as Error).message);
        setKanbanBuildActive(false);
      }
    }, 500);
  };

  const handleHomeScreenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startGeneration();
  };

  const startGeneration = async () => {
    if (!homeUrlInput.trim()) return;

    setHomeScreenFading(true);

    // Set immediate loading state for better UX
    setIsStartingNewGeneration(true);
    setLoadingStage('gathering');

    // Immediately switch to kanban tab to show build progress
    setActiveTab('kanban');

    // Set loading background to ensure proper visual feedback
    setShowLoadingBackground(true);

    // Clear messages and immediately show the initial message
    setChatMessages([]);
    let displayUrl = homeUrlInput.trim();
    if (!displayUrl.match(/^https?:\/\//i)) {
      displayUrl = 'https://' + displayUrl;
    }
    // Remove protocol for cleaner display
    const cleanUrl = displayUrl.replace(/^https?:\/\//i, '');

    // Check if we're in brand extension mode early (used for message and scraping)
    const brandExtensionMode = sessionStorage.getItem('brandExtensionMode') === 'true';
    const brandExtensionPrompt = sessionStorage.getItem('brandExtensionPrompt') || '';
    const storedMarkdown = sessionStorage.getItem('siteMarkdown');

    addChatMessage(
      brandExtensionMode
        ? `Analyzing brand from ${cleanUrl}...`
        : `Starting to clone ${cleanUrl}...`,
      'system'
    );

    // Initialize Build Tracker Agent for this clone operation
    kanban.setTickets([]);
    const buildDescription = brandExtensionMode
      ? `Brand extension: ${cleanUrl}`
      : `Clone: ${cleanUrl}`;
    const mainTicketId = buildTracker.startBuild(buildDescription);
    kanban.setCurrentTicketId(mainTicketId);
    setKanbanBuildActive(true);

    // Set loading stage immediately before hiding home screen
    setLoadingStage('gathering');

    // OPTIMIZATION: Run sandbox creation, screenshot capture, and scraping in parallel
    const sandboxPromise = !sandboxData ? createSandbox(true) : Promise.resolve(null);

    // Start screenshot capture (non-blocking, updates state directly)
    captureUrlScreenshot(displayUrl);

    // Start scraping in parallel with sandbox creation
    const scrapePromise = (async () => {
      if (brandExtensionMode) {
        const extractResponse = await fetch('/api/extract-brand-styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: displayUrl, prompt: brandExtensionPrompt })
        });
        if (!extractResponse.ok) throw new Error('Failed to extract brand styles');
        return { type: 'brand' as const, data: await extractResponse.json() };
      } else if (storedMarkdown) {
        sessionStorage.removeItem('siteMarkdown');
        return {
          type: 'scrape' as const,
          data: { success: true, content: storedMarkdown, title: new URL(displayUrl).hostname, source: 'search-result' } as ScrapeData
        };
      } else {
        const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: displayUrl })
        });
        if (!scrapeResponse.ok) throw new Error('Failed to scrape website');
        return { type: 'scrape' as const, data: await scrapeResponse.json() as ScrapeData };
      }
    })();

    setTimeout(async () => {
      setShowHomeScreen(false);
      setHomeScreenFading(false);

      setTimeout(() => {
        setIsStartingNewGeneration(false);
      }, 1000);

      // Wait for both sandbox and scraping to complete in parallel
      const [createdSandbox, scrapeResult] = await Promise.all([sandboxPromise, scrapePromise]);

      setUrlInput(homeUrlInput);
      setUrlOverlayVisible(false);
      setUrlStatus(['Scraping website content...']);

      try {
        let url = homeUrlInput.trim();
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }

        let scrapeData: ScrapeData | undefined;
        let brandGuidelines: any;

        if (scrapeResult.type === 'brand') {
          brandGuidelines = scrapeResult.data;
          if (!brandGuidelines.success) {
            throw new Error(brandGuidelines.error || 'Failed to extract brand styles');
          }
          addChatMessage(`Acquired branding format from ${cleanUrl}`, 'system', {
            brandingData: brandGuidelines.guidelines,
            sourceUrl: cleanUrl
          });
          addChatMessage(`Building your custom component using these brand guidelines...`, 'system');
          sessionStorage.removeItem('brandExtensionMode');
          sessionStorage.removeItem('brandExtensionPrompt');
        } else {
          scrapeData = scrapeResult.data;
          if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Failed to scrape website');
          }
          if (scrapeData.source === 'search-result') {
            addChatMessage('Using cached content from search results...', 'system');
          }
        }

        setUrlStatus(brandExtensionMode ? ['Brand styles extracted!', 'Building your component...'] : ['Website scraped successfully!', 'Generating React app...']);

        // Clear preparing design state and switch to generation tab
        setIsPreparingDesign(false);
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null); // Clear screenshot when starting generation
        setTargetUrl(''); // Clear target URL

        // Update loading stage to planning
        setLoadingStage('planning');

        // Brief pause before switching to generation tab
        setTimeout(() => {
          setLoadingStage('generating');
          setActiveTab('generation');
        }, 1500);

        // Build the appropriate prompt based on mode
        let prompt;

        if (brandExtensionMode && brandGuidelines) {
          // === BRAND EXTENSION PROMPT ===
          // Store brand guidelines in conversation context
          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, {
              url: url,
              content: { brandGuidelines },
              timestamp: new Date()
            }],
            currentProject: `Custom build using ${url} brand`
          }));

          // Extract comprehensive brand data
          const branding = brandGuidelines.guidelines;

          // Build detailed brand instruction string
          const brandInstructions = `
BRAND GUIDELINES FROM ${url}:

COLOR SYSTEM:
- Color Scheme: ${branding.colorScheme || 'light'} mode
- Primary Color: ${branding.colors?.primary || 'not specified'}
- Accent Color: ${branding.colors?.accent || 'not specified'}
- Background: ${branding.colors?.background || 'not specified'}
- Text Primary: ${branding.colors?.textPrimary || 'not specified'}
- Link Color: ${branding.colors?.link || 'not specified'}

TYPOGRAPHY:
- Primary Font: ${branding.typography?.fontFamilies?.primary || 'system default'}
- Heading Font: ${branding.typography?.fontFamilies?.heading || 'system default'}
- Font Stack (Body): ${branding.typography?.fontStacks?.body?.join(', ') || 'system-ui, sans-serif'}
- Font Stack (Heading): ${branding.typography?.fontStacks?.heading?.join(', ') || 'system-ui, sans-serif'}
- H1 Size: ${branding.typography?.fontSizes?.h1 || '36px'}
- H2 Size: ${branding.typography?.fontSizes?.h2 || '30px'}
- Body Size: ${branding.typography?.fontSizes?.body || '16px'}

SPACING & LAYOUT:
- Base Spacing Unit: ${branding.spacing?.baseUnit || '4'}px
- Border Radius: ${branding.spacing?.borderRadius || '6px'}

BUTTON STYLES:
Primary Button:
  - Background: ${branding.components?.buttonPrimary?.background || branding.colors?.primary}
  - Text Color: ${branding.components?.buttonPrimary?.textColor || '#FFFFFF'}
  - Border Radius: ${branding.components?.buttonPrimary?.borderRadius || branding.spacing?.borderRadius || '8px'}
  - Shadow: ${branding.components?.buttonPrimary?.shadow || 'none'}

Secondary Button:
  - Background: ${branding.components?.buttonSecondary?.background || '#F9F9F9'}
  - Text Color: ${branding.components?.buttonSecondary?.textColor || branding.colors?.textPrimary}
  - Border Radius: ${branding.components?.buttonSecondary?.borderRadius || branding.spacing?.borderRadius || '8px'}
  - Shadow: ${branding.components?.buttonSecondary?.shadow || 'none'}

INPUT FIELDS:
- Border Color: ${branding.components?.input?.borderColor || '#CCCCCC'}
- Border Radius: ${branding.components?.input?.borderRadius || branding.spacing?.borderRadius || '6px'}

BRAND PERSONALITY:
- Tone: ${branding.personality?.tone || 'professional'}
- Energy: ${branding.personality?.energy || 'medium'}
- Target Audience: ${branding.personality?.targetAudience || 'general'}

DESIGN SYSTEM:
- Framework: ${branding.designSystem?.framework || 'tailwind'}
- Component Library: ${branding.designSystem?.componentLibrary || 'custom'}

ASSETS:
${branding.images?.logo ? `- Logo Available: Yes (use carefully if needed)` : '- Logo: Not available'}
${branding.images?.favicon ? `- Favicon: ${branding.images.favicon}` : ''}`;

          prompt = `I want you to build a NEW React component/application based on these brand guidelines and the user's requirements.

<branding-format source="${url}">
${brandInstructions}

RAW BRAND DATA (for reference):
${JSON.stringify(branding, null, 2)}
</branding-format>

USER'S REQUEST:
${brandExtensionPrompt || 'Build a modern web component using these brand guidelines'}

IMPORTANT: The content above in the <branding-format> tags contains the extracted brand guidelines from ${url}.
Use these guidelines (colors, fonts, spacing, design patterns) to build what the user requested.

CRITICAL REQUIREMENTS:
- DO NOT recreate the original website at ${url}
- DO create a COMPLETELY NEW component that fulfills the user's request
- The user wants: "${brandExtensionPrompt}"
- Build ONLY what the user requested - nothing more
- App.jsx should render ONLY the requested component - no extra Header/Footer/Hero unless specifically requested
- Make it a minimal, focused implementation of the user's request

STYLING REQUIREMENTS:
- Apply the EXACT colors from the brand palette (primary, accent, background, text colors)
- Use the EXACT typography (font families, font sizes for h1, h2, body)
- Apply the spacing system (base unit: ${branding.spacing?.baseUnit || '4'}px)
- Use the specified border radius (${branding.spacing?.borderRadius || '6px'}) consistently
- Implement button styles EXACTLY as specified (colors, shadows, border radius)
- Style input fields with the exact border color and border radius
- Match the brand's ${branding.colorScheme || 'light'} color scheme
- Apply the brand personality: ${branding.personality?.tone || 'professional'} tone with ${branding.personality?.energy || 'medium'} energy
- Use Tailwind CSS with inline color values matching the brand palette EXACTLY
- If fonts need to be imported, add @import or @font-face rules to index.css
- Create custom CSS classes in index.css for complex shadows/effects that can't be done with Tailwind

FONT SETUP:
${branding.typography?.fontFamilies?.primary ? `
- Add font family "${branding.typography.fontFamilies.primary}" to your CSS
- Use font stack: ${branding.typography?.fontStacks?.body?.join(', ') || 'system-ui, sans-serif'}
- Set body font size to ${branding.typography?.fontSizes?.body || '16px'}` : '- Use system fonts'}

COMPONENT STRUCTURE:
- src/index.css - Include brand fonts, custom shadows/effects, and base styling
- src/App.jsx - Should ONLY render the requested component (e.g., just <PricingPage /> if user wants pricing)
- src/components/[RequestedComponent].jsx - The actual component fulfilling the user's request

TECHNICAL REQUIREMENTS:
- Create a WORKING, self-contained application
- DO NOT import components that don't exist
- Make sure the app renders immediately with visible content
- All colors must match the brand palette EXACTLY
- All spacing must use the ${branding.spacing?.baseUnit || '4'}px base unit
- Buttons must have the exact styling specified in the guidelines

Focus on building something NEW, minimal, and functional that perfectly matches the ${brandGuidelines.styleName || 'brand'} aesthetic and design system.`;

        } else {
          // === NORMAL CLONE MODE PROMPT ===
          // Store scraped data in conversation context
          if (!scrapeData) {
            throw new Error('Scrape data is missing');
          }
          setConversationContext(prev => ({
            ...prev,
            scrapedWebsites: [...prev.scrapedWebsites, {
              url: url,
              content: scrapeData,
              timestamp: new Date()
            }],
            currentProject: `${url} Clone`
          }));

          // Filter out style-related context when using screenshot/URL-based generation
          // Only keep user's explicit instructions, not inherited styles
          let filteredContext = homeContextInput;
          if (homeUrlInput && homeContextInput) {
            // Check if the context contains default style names that shouldn't be inherited
            const stylePatterns = [
              'Glassmorphism style design',
              'Neumorphism style design',
              'Brutalism style design',
              'Minimalist style design',
              'Dark Mode style design',
              'Gradient Rich style design',
              '3D Depth style design',
              'Retro Wave style design',
              'Modern clean and minimalist style design',
              'Fun colorful and playful style design',
              'Corporate professional and sleek style design',
              'Creative artistic and unique style design'
            ];

            // If the context exactly matches or starts with a style pattern, filter it out
            const startsWithStyle = stylePatterns.some(pattern =>
              homeContextInput.trim().startsWith(pattern)
            );

            if (startsWithStyle) {
              // Extract only the additional instructions part after the style
              const additionalMatch = homeContextInput.match(/\. (.+)$/);
              filteredContext = additionalMatch ? additionalMatch[1] : '';
            }
          }

          prompt = `I want to recreate the ${url} website as a complete React application based on the scraped content below.

${JSON.stringify(scrapeData, null, 2)}

${filteredContext ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
${filteredContext}

Please incorporate these requirements into the design and implementation.` : ''}

IMPORTANT INSTRUCTIONS:
- Create a COMPLETE, working React application
- Implement ALL sections and features from the original site
- Use Tailwind CSS for all styling (no custom CSS files)
- Make it responsive and modern
- Ensure all text content matches the original
- Create proper component structure
- Make sure the app actually renders visible content
- Create ALL components that you reference in imports
${filteredContext ? '- Apply the user\'s context/theme requirements throughout the application' : ''}

Focus on the key sections and content, making it clean and modern.`;
        }

        setGenerationProgress(prev => ({
          isGenerating: true,
          status: 'Initializing AI...',
          components: [],
          currentComponent: 0,
          streamedCode: '',
          isStreaming: true,
          isThinking: false,
          thinkingText: undefined,
          thinkingDuration: undefined,
          // Keep previous files until new ones are generated
          files: prev.files || [],
          currentFile: undefined,
          lastProcessedPosition: 0
        }));

        const aiResponse = await fetch('/api/generate-ai-code-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: aiModel,
            context: {
              sandboxId: sandboxData?.sandboxId,
              structure: structureContent,
              conversationContext: conversationContext
            }
          })
        });

        if (!aiResponse.ok || !aiResponse.body) {
          throw new Error('Failed to generate code');
        }

        const reader = aiResponse.body.getReader();
        const decoder = new TextDecoder();
        let generatedCode = '';
        let explanation = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';

                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');

                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') &&
                    !text.includes('export default') && !text.includes('className=') &&
                    text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;

                    // Let Build Tracker Agent handle ticket creation (clone mode)
                    buildTracker.processStreamedCode(newStreamedCode);

                    const updatedState = {
                      ...prev,
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };

                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));

                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];

                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);

                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }

                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }

                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];

                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                          fileExt === 'css' ? 'css' :
                            fileExt === 'json' ? 'json' :
                              fileExt === 'html' ? 'html' : 'text';

                        updatedState.currentFile = {
                          path: filePath,
                          content: partialContent,
                          type: fileType
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }

                    return updatedState;
                  });
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;

                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }

        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        if (generatedCode) {
          addChatMessage('AI recreation generated!', 'system');

          // Add the explanation to chat if available
          if (explanation && explanation.trim()) {
            addChatMessage(explanation, 'ai');
          }

          setPromptInput(generatedCode);

          // Tell Build Tracker Agent we're applying
          buildTracker.markApplying();

          // Apply the code (first time is not edit mode)
          await applyGeneratedCode(generatedCode, false);

          addChatMessage(
            brandExtensionMode
              ? `Successfully built your custom component using ${cleanUrl}'s brand guidelines! You can now ask me to modify it or add more features.`
              : `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`,
            'ai',
            {
              scrapedUrl: url,
              scrapedContent: brandExtensionMode ? { brandGuidelines } : scrapeData,
              generatedCode: generatedCode
            }
          );

          setConversationContext(prev => ({
            ...prev,
            generatedComponents: [],
            appliedCode: [...prev.appliedCode, {
              files: [],
              timestamp: new Date()
            }]
          }));
        } else {
          throw new Error('Failed to generate recreation');
        }

        setUrlInput('');
        setUrlStatus([]);
        setHomeContextInput('');

        // Clear generation progress and all screenshot/design states
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: 'Generation complete!'
        }));

        // Tell Build Tracker Agent build is complete
        buildTracker.markCompleted();
        setKanbanBuildActive(false);

        // Clear screenshot and preparing design states to prevent them from showing on next run
        setIsScreenshotLoaded(false); // Reset loaded state
        setUrlScreenshot(null);
        setIsPreparingDesign(false);
        setTargetUrl('');
        setScreenshotError(null);
        setLoadingStage(null); // Clear loading stage
        setIsStartingNewGeneration(false); // Clear new generation flag
        setShowLoadingBackground(false); // Clear loading background

        setTimeout(() => {
          // Switch back to preview tab but keep files
          setActiveTab('preview');
        }, 1000); // Show completion briefly then switch
      } catch (error: any) {
        addChatMessage(`Failed to clone website: ${error.message}`, 'system');
        setUrlStatus([]);
        setIsPreparingDesign(false);
        setIsStartingNewGeneration(false); // Clear new generation flag on error
        setLoadingStage(null);
        // Also clear generation progress on error
        setGenerationProgress(prev => ({
          ...prev,
          isGenerating: false,
          isStreaming: false,
          status: '',
          // Keep files to display in sidebar
          files: prev.files
        }));

        // Tell Build Tracker Agent build failed
        buildTracker.markFailed(error.message);
        setKanbanBuildActive(false);
      }
    }, 500);
  };

  return (
    <HeaderProvider>
      <div className="font-sans bg-background text-foreground h-screen flex flex-col">
        <div className="bg-white py-2 px-4 border-b border-border-faint flex items-center justify-between shadow-sm">
          <HeaderBrandKit />
          <div className="flex items-center gap-2">
            {/* Model Selector - Left side */}
            <select
              value={aiModel}
              onChange={(e) => {
                const newModel = e.target.value;
                setAiModel(newModel);
                const params = new URLSearchParams(searchParams);
                params.set('model', newModel);
                if (sandboxData?.sandboxId) {
                  params.set('sandbox', sandboxData.sandboxId);
                }
                router.push(`/generation?${params.toString()}`);
              }}
              className="px-3 py-1.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
            >
              {appConfig.ai.availableModels.map(model => (
                <option key={model} value={model}>
                  {appConfig.ai.modelDisplayNames?.[model] || model}
                </option>
              ))}
            </select>
            <button
              onClick={() => createSandbox()}
              className="p-2 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
              title="Create new sandbox"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={reapplyLastGeneration}
              className="p-2 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Re-apply last generation"
              disabled={!conversationContext.lastGeneratedCode || !sandboxData}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={downloadZip}
              disabled={!sandboxData}
              className="p-2 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download your Vite app as ZIP"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeployModal(true)}
              className="p-2 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
              title="Deploy (Vercel/Netlify)"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className={`p-2 rounded-lg transition-colors border ${showVersionHistory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
              title="Version History"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="border-l border-gray-200 h-6 mx-1" />
            <GitHubConnectButton className="text-sm" />
            <GitSyncToggle
              isEnabled={gitSync.isEnabled}
              isSyncing={gitSync.isSyncing}
              lastCommitSha={gitSync.lastCommitSha}
              lastCommitUrl={gitSync.lastCommitUrl}
              error={gitSync.error}
              onEnable={gitSync.enableSync}
              onDisable={gitSync.disableSync}
              className="mr-2"
            />
            <LoginButton className="text-sm" />
            <UserMenu />
            <UsagePill className="mr-1" />
            {versioning.saveStatus.local !== 'idle' && (
              <SaveStatusIndicator status={versioning.saveStatus} />
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Center Panel - AI Chat (1/3 of remaining width) */}
          <div className="w-[320px] flex-none flex flex-col border-r border-border bg-white">
            {/* Sidebar Input Component */}
            {!hasInitialSubmission ? (
              <div className="p-4 border-b border-border">
                <SidebarInput
                  onSubmit={async (url, style, model, instructions) => {
                    setHasInitialSubmission(true);
                    setAiModel(model);
                    // Create a plan from the clone URL request
                    const prompt = `Clone and recreate the website at ${url}. ${instructions ? `Additional instructions: ${instructions}` : ''} Style preference: ${style}`;
                    await planBuild(prompt);
                  }}
                  onPromptSubmit={async (prompt, model) => {
                    setAiModel(model);
                    // Generate 3 UI options for user to choose from
                    await generateUIOptions(prompt);
                  }}
                  onImportSubmit={async (repoFullName, branch, maxFiles, model, goalPrompt) => {
                    await handleGitHubImportAndPlan(repoFullName, branch, maxFiles, model, goalPrompt);
                  }}
                  disabled={generationProgress.isGenerating || isPlanning || isLoadingUIOptions || isImportingRepo}
                />
              </div>
            ) : null}

            {(isPlanning || kanban.tickets.length > 0) && hasInitialSubmission && (
              <div className="flex-1 overflow-y-auto border-b border-border">
                <div className="p-3 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isPlanning && (
                        <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      <span className="text-xs font-semibold text-gray-700">
                        {isPlanning ? 'Planning Build...' : `Build Plan (${kanban.tickets.length} tasks)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isPlanning && kanban.tickets.length > 0 && lastImportedRepo && sandboxData && (
                        <button
                          onClick={handleLoadImportedRepoIntoSandbox}
                          disabled={isLoadingRepoIntoSandbox || kanbanBuildActive}
                          className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                            isLoadingRepoIntoSandbox || kanbanBuildActive
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title="Replace sandbox files with the imported repo and restart dev server"
                        >
                          {isLoadingRepoIntoSandbox ? 'Loading…' : 'Load to sandbox'}
                        </button>
                      )}

                      {!isPlanning && kanban.tickets.length > 0 && !kanbanBuildActive && (
                        <button
                          onClick={() => handleStartKanbanBuild()}
                          className="px-2 py-1 text-[10px] font-medium rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                        >
                          Start Build
                        </button>
                      )}
                    </div>
                  </div>
                  {kanban.tickets.length > 0 && (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${kanban.tickets.length > 0 ? (kanban.tickets.filter(t => t.status === 'done').length / kanban.tickets.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-1.5">
                  {kanban.tickets.map((ticket, idx) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-2.5 rounded-lg border transition-all ${
                        ticket.status === 'done' ? 'bg-green-50 border-green-200' :
                        ticket.status === 'generating' ? 'bg-orange-50 border-orange-200' :
                        ticket.status === 'failed' ? 'bg-red-50 border-red-200' :
                        'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-sm">
                          {ticket.status === 'done' ? '✅' :
                           ticket.status === 'generating' ? '⚡' :
                           ticket.status === 'failed' ? '❌' :
                           ticket.status === 'backlog' ? '📋' :
                           ticket.status === 'planning' ? '🎯' : '⏳'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{ticket.title}</div>
                          <div className="text-[10px] text-gray-500 truncate">{ticket.description}</div>
                          {ticket.status === 'generating' && ticket.progress !== undefined && (
                            <div className="mt-1.5 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-400 transition-all duration-300"
                                style={{ width: `${ticket.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          ticket.type === 'component' ? 'bg-blue-100 text-blue-700' :
                          ticket.type === 'feature' ? 'bg-green-100 text-green-700' :
                          ticket.type === 'layout' ? 'bg-purple-100 text-purple-700' :
                          ticket.type === 'styling' ? 'bg-pink-100 text-pink-700' :
                          ticket.type === 'integration' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {ticket.type}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {isPlanning && (
                    <div className="flex items-center gap-2 p-2 text-gray-400">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
                      <span className="text-[10px]">Analyzing requirements...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {conversationContext.scrapedWebsites.length > 0 && !hasInitialSubmission && (
              <div className="p-4 bg-card border-b border-gray-200">
                <div className="flex flex-col gap-4">
                  {conversationContext.scrapedWebsites.map((site, idx) => {
                    // Extract favicon and site info from the scraped data
                    const metadata = site.content?.metadata || {};
                    const sourceURL = metadata.sourceURL || site.url;
                    const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                    const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;
                    const screenshot = site.content?.screenshot || sessionStorage.getItem('websiteScreenshot');

                    return (
                      <div key={idx} className="flex flex-col gap-3">
                        {/* Site info with favicon */}
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

                        {/* Pinned screenshot */}
                        {screenshot && (
                          <div className="w-full">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-600">Screenshot Preview</span>
                              <button
                                onClick={() => setScreenshotCollapsed(!screenshotCollapsed)}
                                className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                                aria-label={screenshotCollapsed ? 'Expand screenshot' : 'Collapse screenshot'}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className={`transition-transform duration-300 ${screenshotCollapsed ? 'rotate-180' : ''}`}
                                >
                                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                            <div
                              className="w-full rounded-lg overflow-hidden border border-gray-200 transition-all duration-300"
                              style={{
                                opacity: screenshotCollapsed ? 0 : 1,
                                transform: screenshotCollapsed ? 'translateY(-20px)' : 'translateY(0)',
                                pointerEvents: screenshotCollapsed ? 'none' : 'auto',
                                maxHeight: screenshotCollapsed ? '0' : '200px'
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={screenshot}
                                alt={`${siteName} preview`}
                                className="w-full h-auto object-cover"
                                style={{ maxHeight: '200px' }}
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

            {!hasInitialSubmission && (
            <div
              className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide bg-gray-50"
              ref={chatMessagesRef}>
              {chatMessages.map((msg, idx) => {
                // Check if this message is from a successful generation
                const isGenerationComplete = msg.content.includes('Successfully recreated') ||
                  msg.content.includes('AI recreation generated!') ||
                  msg.content.includes('Code generated!');

                // Get the files from metadata if this is a completion message
                // const completedFiles = msg.metadata?.appliedFiles || [];

                return (
                  <div key={idx} className="block">
                    <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className="block">
                        <div className={`block rounded-lg px-3 py-2 ${msg.type === 'user' ? 'bg-[#36322F] text-white ml-auto max-w-[80%]' :
                          msg.type === 'ai' ? 'bg-gray-100 text-gray-900 mr-auto max-w-[80%]' :
                            msg.type === 'system' ? 'bg-[#36322F] text-white text-sm' :
                              msg.type === 'command' ? 'bg-[#36322F] text-white font-mono text-sm' :
                                msg.type === 'error' ? 'bg-red-900 text-red-100 text-sm border border-red-700' :
                                  'bg-[#36322F] text-white text-sm'
                          }`}>
                          {msg.type === 'command' ? (
                            <div className="flex items-start gap-2">
                              <span className={`text-xs ${msg.metadata?.commandType === 'input' ? 'text-blue-400' :
                                msg.metadata?.commandType === 'error' ? 'text-red-400' :
                                  msg.metadata?.commandType === 'success' ? 'text-green-400' :
                                    'text-gray-400'
                                }`}>
                                {msg.metadata?.commandType === 'input' ? '$' : '>'}
                              </span>
                              <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                            </div>
                          ) : msg.type === 'error' ? (
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

                        {/* Show branding data if this is a brand extraction message */}
                        {msg.metadata?.brandingData && (
                          <div className="mt-3 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl overflow-hidden max-w-[500px] shadow-sm">
                            <div className="bg-[#36322F] px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Image
                                  src={`https://www.google.com/s2/favicons?domain=${msg.metadata.sourceUrl}&sz=32`}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="w-8 h-8"
                                />
                                <div className="text-sm font-semibold text-white">
                                  Brand Guidelines
                                </div>
                              </div>
                            </div>

                            <div className="p-4">
                              {/* Color Scheme Mode */}
                              {msg.metadata.brandingData.colorScheme && (
                                <div className="mb-4">
                                  <div className="text-sm">
                                    <span className="text-gray-600 font-medium">Mode:</span>{' '}
                                    <span className="font-semibold text-gray-900 capitalize">{msg.metadata.brandingData.colorScheme}</span>
                                  </div>
                                </div>
                              )}

                              {/* Colors */}
                              {msg.metadata.brandingData.colors && (
                                <div className="mb-4">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">Colors</div>
                                  <div className="flex flex-wrap gap-3">
                                    {msg.metadata.brandingData.colors.primary && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.primary }} />
                                        <div className="text-sm">
                                          <div className="font-semibold text-gray-900">Primary</div>
                                          <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.primary}</div>
                                        </div>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.colors.accent && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.accent }} />
                                        <div className="text-sm">
                                          <div className="font-semibold text-gray-900">Accent</div>
                                          <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.accent}</div>
                                        </div>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.colors.background && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.background }} />
                                        <div className="text-sm">
                                          <div className="font-semibold text-gray-900">Background</div>
                                          <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.background}</div>
                                        </div>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.colors.textPrimary && (
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.textPrimary }} />
                                        <div className="text-sm">
                                          <div className="font-semibold text-gray-900">Text</div>
                                          <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.textPrimary}</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Typography */}
                              {msg.metadata.brandingData.typography && (
                                <div className="mb-4">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">Typography</div>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    {msg.metadata.brandingData.typography.fontFamilies?.primary && (
                                      <div>
                                        <span className="text-gray-600 font-medium">Primary:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.primary}</span>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.typography.fontFamilies?.heading && (
                                      <div>
                                        <span className="text-gray-600 font-medium">Heading:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.heading}</span>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.typography.fontSizes?.h1 && (
                                      <div>
                                        <span className="text-gray-600 font-medium">H1 Size:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h1}</span>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.typography.fontSizes?.h2 && (
                                      <div>
                                        <span className="text-gray-600 font-medium">H2 Size:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h2}</span>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.typography.fontSizes?.body && (
                                      <div>
                                        <span className="text-gray-600 font-medium">Body Size:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.body}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Spacing */}
                              {msg.metadata.brandingData.spacing && (
                                <div className="mb-4">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">Spacing</div>
                                  <div className="flex flex-wrap gap-4 text-sm">
                                    {msg.metadata.brandingData.spacing.baseUnit && (
                                      <div>
                                        <span className="text-gray-600 font-medium">Base Unit:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.baseUnit}px</span>
                                      </div>
                                    )}
                                    {msg.metadata.brandingData.spacing.borderRadius && (
                                      <div>
                                        <span className="text-gray-600 font-medium">Border Radius:</span>{' '}
                                        <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.borderRadius}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Button Styles */}
                              {msg.metadata.brandingData.components?.buttonPrimary && (
                                <div className="mb-4">
                                  <div className="text-sm font-semibold text-gray-900 mb-2">Button Styles</div>
                                  <div className="flex flex-wrap gap-3">
                                    <div>
                                      <div className="text-xs text-gray-600 mb-1.5 font-medium">Primary Button</div>
                                      <button
                                        className="px-4 py-2 text-sm font-medium"
                                        style={{
                                          backgroundColor: msg.metadata.brandingData.components.buttonPrimary.background,
                                          color: msg.metadata.brandingData.components.buttonPrimary.textColor,
                                          borderRadius: msg.metadata.brandingData.components.buttonPrimary.borderRadius,
                                          boxShadow: msg.metadata.brandingData.components.buttonPrimary.shadow
                                        }}
                                      >
                                        Sample Button
                                      </button>
                                    </div>
                                    {msg.metadata.brandingData.components?.buttonSecondary && (
                                      <div>
                                        <div className="text-xs text-gray-600 mb-1.5 font-medium">Secondary Button</div>
                                        <button
                                          className="px-4 py-2 text-sm font-medium"
                                          style={{
                                            backgroundColor: msg.metadata.brandingData.components.buttonSecondary.background,
                                            color: msg.metadata.brandingData.components.buttonSecondary.textColor,
                                            borderRadius: msg.metadata.brandingData.components.buttonSecondary.borderRadius,
                                            boxShadow: msg.metadata.brandingData.components.buttonSecondary.shadow
                                          }}
                                        >
                                          Sample Button
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Personality */}
                              {msg.metadata.brandingData.personality && (
                                <div className="text-sm">
                                  <span className="text-gray-600 font-medium">Personality:</span>{' '}
                                  <span className="font-semibold text-gray-900 capitalize">
                                    {msg.metadata.brandingData.personality.tone} tone, {msg.metadata.brandingData.personality.energy} energy
                                  </span>
                                </div>
                              )}

                              {/* Target Audience */}
                              {msg.metadata.brandingData.personality?.targetAudience && (
                                <div className="text-sm mt-8">
                                  <span className="text-gray-600 font-medium">Target:</span>{' '}
                                  <span className="text-gray-900">{msg.metadata.brandingData.personality.targetAudience}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Show applied files if this is an apply success message */}
                        {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                          <div className="mt-3 inline-block bg-gray-100 rounded-lg p-3">
                            <div className="text-sm font-medium mb-3 text-gray-700">
                              {msg.content.includes('Applied') ? 'Files Updated:' : 'Generated Files:'}
                            </div>
                            <div className="flex flex-wrap items-start gap-2">
                              {msg.metadata.appliedFiles.map((filePath, fileIdx) => {
                                const fileName = filePath.split('/').pop() || filePath;
                                const fileExt = fileName.split('.').pop() || '';
                                const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                  fileExt === 'css' ? 'css' :
                                    fileExt === 'json' ? 'json' : 'text';

                                return (
                                  <div
                                    key={`applied-${fileIdx}`}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-sm animate-fade-in-up"
                                    style={{ animationDelay: `${fileIdx * 30}ms` }}
                                  >
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${fileType === 'css' ? 'bg-blue-400' :
                                      fileType === 'javascript' ? 'bg-yellow-400' :
                                        fileType === 'json' ? 'bg-green-400' :
                                          'bg-gray-400'
                                      }`} />
                                    {fileName}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Show generated files for completion messages - but only if no appliedFiles already shown */}
                        {isGenerationComplete && generationProgress.files.length > 0 && idx === chatMessages.length - 1 && !msg.metadata?.appliedFiles && !chatMessages.some(m => m.metadata?.appliedFiles) && (
                          <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                            <div className="text-xs font-medium mb-1 text-gray-700">Generated Files:</div>
                            <div className="flex flex-wrap items-start gap-1">
                              {generationProgress.files.map((file, fileIdx) => (
                                <div
                                  key={`complete-${fileIdx}`}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-xs animate-fade-in-up"
                                  style={{ animationDelay: `${fileIdx * 30}ms` }}
                                >
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${file.type === 'css' ? 'bg-blue-400' :
                                    file.type === 'javascript' ? 'bg-yellow-400' :
                                      file.type === 'json' ? 'bg-green-400' :
                                        'bg-gray-400'
                                    }`} />
                                  {file.path.split('/').pop()}
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

              {/* Code application progress */}
              {codeApplicationState.stage && (
                <CodeApplicationProgress state={codeApplicationState} />
              )}

              {/* File generation progress - inline display (during generation) */}
              {generationProgress.isGenerating && (
                <div className="inline-block bg-gray-100 rounded-lg p-3">
                  <div className="text-sm font-medium mb-2 text-gray-700">
                    {generationProgress.status}
                  </div>
                  <div className="flex flex-wrap items-start gap-1">
                    {/* Show completed files */}
                    {generationProgress.files.map((file, idx) => (
                      <div
                        key={`file-${idx}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#36322F] text-white rounded-md text-xs animate-fade-in-up"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        {file.path.split('/').pop()}
                      </div>
                    ))}

                    {/* Show current file being generated */}
                    {generationProgress.currentFile && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-sm animate-pulse"
                        style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}>
                        <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {generationProgress.currentFile.path.split('/').pop()}
                      </div>
                    )}
                  </div>

                  {/* Live streaming response display */}
                  {generationProgress.streamedCode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
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
                            padding: '0.75rem',
                            fontSize: '11px',
                            lineHeight: '1.5',
                            background: 'transparent',
                            maxHeight: '8rem',
                            overflow: 'hidden'
                          }}
                        >
                          {(() => {
                            const lastContent = generationProgress.streamedCode.slice(-1000);
                            // Show the last part of the stream, starting from a complete tag if possible
                            const startIndex = lastContent.indexOf('<');
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
            )}

            {/* Suggested follow-up actions after generation */}
            {!generationProgress.isGenerating && generationProgress.files.length > 0 && !aiChatInput && (
              <div className="px-4 py-2 border-t border-border bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Add dark mode', prompt: 'Add a dark mode toggle and apply dark theme styles' },
                    { label: 'Improve animations', prompt: 'Add smooth animations and hover effects to all interactive elements' },
                    { label: 'Make responsive', prompt: 'Ensure the layout is fully responsive for mobile, tablet, and desktop' },
                    { label: 'Add more sections', prompt: 'Add more content sections like testimonials, FAQ, and contact form' }
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => {
                        setAiChatInput(action.prompt);
                      }}
                      className="px-3 py-1.5 text-xs bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-full transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-border bg-background-base">
              <HeroInput
                value={aiChatInput}
                onChange={setAiChatInput}
                onSubmit={sendChatMessage}
                placeholder="Describe what you want to build..."
                showSearchFeatures={false}
              />
            </div>
          </div>

          {/* Right Panel - Preview or Generation (2/3 of remaining width) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-4 pb-4 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Toggle-style Code/View switcher */}
                <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                  <button
                    onClick={() => setActiveTab('generation')}
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${activeTab === 'generation'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <span>Code</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${activeTab === 'preview'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('kanban')}
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${activeTab === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      <span>Kanban</span>
                      {kanban.tickets.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-600 rounded-full">
                          {kanban.tickets.filter(t => t.status === 'done').length}/{kanban.tickets.length}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('split')}
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${activeTab === 'split'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    title="Split view: Kanban + Preview side by side"
                  >
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m6 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      <span>Split</span>
                    </div>
                  </button>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* Device Frame Toggles - Only show in preview mode */}
                {activeTab === 'preview' && sandboxData && (
                  <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded transition-all ${previewDevice === 'desktop' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'}`}
                      title="Desktop view"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={previewDevice === 'desktop' ? 'text-gray-900' : 'text-gray-500'}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPreviewDevice('tablet')}
                      className={`p-1.5 rounded transition-all ${previewDevice === 'tablet' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'}`}
                      title="Tablet view"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={previewDevice === 'tablet' ? 'text-gray-900' : 'text-gray-500'}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded transition-all ${previewDevice === 'mobile' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'}`}
                      title="Mobile view"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={previewDevice === 'mobile' ? 'text-gray-900' : 'text-gray-500'}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Files generated count */}
                {activeTab === 'generation' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                  <div className="text-gray-500 text-xs font-medium">
                    {generationProgress.files.length} files generated
                  </div>
                )}

                {/* Live Code Generation Status */}
                {activeTab === 'generation' && generationProgress.isGenerating && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {generationProgress.isEdit ? 'Editing code' : 'Live generation'}
                  </div>
                )}

                {/* Sandbox Status Indicator */}
                {sandboxData && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Sandbox active
                  </div>
                )}

                {/* Copy URL button */}
                {sandboxData && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sandboxData.url);
                      setShowCopiedToast(true);
                      setTimeout(() => setShowCopiedToast(false), 2000);
                    }}
                    title="Copy sandbox URL"
                    className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative"
                  >
                    {showCopiedToast ? (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-green-500">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Fullscreen preview button */}
                {sandboxData && (
                  <button
                    onClick={() => setIsFullscreenPreview(true)}
                    title="Fullscreen preview (⌘⇧F)"
                    className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                )}

                {/* Open in new tab button */}
                {sandboxData && (
                  <a
                    href={sandboxData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
            <div className="flex-1 relative overflow-hidden">
              {renderMainContent()}
            </div>
          </div>

          {showVersionHistory && (
            <div className="w-[280px] border-l border-gray-200 bg-gray-900 flex-shrink-0 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-800">
                <button
                  onClick={() => setVersionHistoryTab('plan')}
                  className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors ${
                    versionHistoryTab === 'plan'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  Plan
                </button>
                <button
                  onClick={() => setVersionHistoryTab('code')}
                  className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors ${
                    versionHistoryTab === 'code'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  Code
                </button>
              </div>

              {versionHistoryTab === 'plan' ? (
                <PlanVersionHistoryPanel
                  versions={planVersions.versions}
                  currentTickets={kanban.tickets}
                  isLoading={planVersions.isLoading}
                  error={planVersions.error}
                  onRefresh={planVersions.refresh}
                  onCreateSnapshot={handleCreateManualPlanSnapshot}
                  onRestore={handleRestorePlanSnapshot}
                  restoreDisabled={kanbanBuildActive}
                  className="h-full"
                />
              ) : (
                <VersionHistoryPanel
                  versions={versioning.versions}
                  currentVersionId={versioning.currentProject?.currentVersionId}
                  onRestore={async (versionId) => {
                    const files = await versioning.restoreVersion(versionId);
                    if (files && sandboxData) {
                      const code = files.map(f => `<file path="${f.path}">${f.content}</file>`).join('\n');
                      await applyGeneratedCode(code, false);
                      addChatMessage('Version restored successfully!', 'system');
                    }
                  }}
                  className="h-full"
                />
              )}
            </div>
          )}
        </div>

        {/* UI Options Selector Modal */}
        {showUIOptions && (
          <UIOptionsSelector
            options={uiOptions}
            onSelect={(option) => {
              setHasInitialSubmission(true);
              handleUIOptionSelect(option);
            }}
            onCancel={handleUIOptionsCancel}
            isLoading={isLoadingUIOptions}
          />
        )}

        {/* Code Review Panel Modal */}
        {showCodeReview && bugbot.lastReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="max-w-2xl w-full mx-4">
              <CodeReviewPanel
                result={bugbot.lastReview}
                onDismiss={handleCodeReviewDismiss}
                onApprove={handleCodeReviewApprove}
              />
            </div>
          </div>
        )}

        {/* Regression Warning Modal */}
        {regressionWarning && (
          <RegressionWarningModal
            isOpen={regressionWarning.isOpen}
            ticketTitle={regressionWarning.ticketTitle}
            fromColumn={regressionWarning.fromColumn}
            toColumn={regressionWarning.toColumn}
            onConfirm={handleRegressionConfirm}
            onCancel={handleRegressionCancel}
          />
        )}

        {/* Deploy Modal */}
        {showDeployModal &&
          (() => {
            const cfg = gitSync.loadConfig();
            const repoUrl = cfg?.repoFullName ? `https://github.com/${cfg.repoFullName}` : undefined;
            const branch = cfg?.branch || 'main';
            const templateTarget: 'vite' | 'next' = sandboxData?.templateTarget === 'next' ? 'next' : 'vite';
            const projectName = conversationContext.currentProject || 'paynto-app';

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowDeployModal(false)}
                      className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <DeployPanel
                    projectName={projectName}
                    repoUrl={repoUrl}
                    branch={branch}
                    templateTarget={templateTarget}
                    onDeployComplete={(url) => {
                      addChatMessage(`🚀 Deployed: ${url}`, 'system');
                      setShowDeployModal(false);
                    }}
                  />
                </div>
              </div>
            );
          })()}

        {/* Load Repo Into Sandbox Progress Modal */}
        {renderRepoLoadModal()}

        {/* Fullscreen Preview Modal */}
        {isFullscreenPreview && sandboxData?.url && (
          <div className="fixed inset-0 z-50 bg-black">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              {/* Device toggles in fullscreen */}
              <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-2 rounded transition-all ${previewDevice === 'desktop' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-2 rounded transition-all ${previewDevice === 'tablet' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-2 rounded transition-all ${previewDevice === 'mobile' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setIsFullscreenPreview(false)}
                className="p-2 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-all"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="w-full h-full flex items-center justify-center p-8">
              <div
                className={`h-full transition-all duration-300 ${previewDevice !== 'desktop' ? 'rounded-xl overflow-hidden shadow-2xl' : 'w-full'}`}
                style={previewDevice === 'desktop' ? {} : previewDevice === 'tablet' ? { width: '768px' } : { width: '375px' }}
              >
                <iframe
                  src={sandboxData.url}
                  className="w-full h-full border-none bg-white rounded-lg"
                  title="Fullscreen Preview"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </HeaderProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AISandboxPage />
    </Suspense>
  );
}