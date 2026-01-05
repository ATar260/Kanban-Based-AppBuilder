'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { appConfig } from '@/config/app.config';
import type { GenerationComposerMode } from '@/components/app/generation/GenerationComposer';
import GenerationLeftPanel from '@/components/app/generation/GenerationLeftPanel';
import type { ConversationContext, GenerationChatMessage, GenerationProgressState, SandboxData, ScrapeData } from '@/types/generation';
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
import { type CodeApplicationState } from '@/components/CodeApplicationProgress';
import { KanbanBoard, useKanbanBoard, KanbanTicket as KanbanTicketType, BuildPlan, TicketStatus } from '@/components/kanban';
import { useVersioning } from '@/hooks/useVersioning';
import { GitHubConnectButton, VersionHistoryPanel, SaveStatusIndicator } from '@/components/versioning';
import { saveGitHubConnection } from '@/lib/versioning/github';
import { useBuildTracker } from '@/hooks/useBuildTracker';
import { UserMenu, LoginButton } from '@/components/auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import Button from '@/components/ui/shadcn/button';

function AISandboxPage() {
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState<GenerationChatMessage[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [composerMode, setComposerMode] = useState<GenerationComposerMode>('build');
  const [buildPromptDraft, setBuildPromptDraft] = useState('');
  const [cloneUrlDraft, setCloneUrlDraft] = useState('');
  const [aiEnabled] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [activeTab, setActiveTab] = useState<'code' | 'preview' | 'kanban'>('kanban');
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
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([]);
  const [newBuildConfirmOpen, setNewBuildConfirmOpen] = useState(false);
  const [newBuildBusy, setNewBuildBusy] = useState(false);
  const [fileStructure, setFileStructure] = useState<string>('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [kanbanBuildActive, setKanbanBuildActive] = useState(false);
  const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false);
  const [sandboxExpired, setSandboxExpired] = useState(false);

  const kanban = useKanbanBoard();

  // Build Tracker Agent - monitors generation and updates Kanban tickets
  const buildTracker = useBuildTracker({
    onTicketCreate: kanban.addTicket,
    onTicketUpdate: kanban.editTicket,
    onTicketStatusChange: kanban.updateTicketStatus,
    onProgressUpdate: kanban.updateTicketProgress
  });

  const versioning = useVersioning({ enableAutoSave: true, autoSaveInterval: 5 * 60 * 1000 });
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: '',
    lastGeneratedCode: undefined
  });

  // Once we have applied code, default the unified composer into Edit mode.
  useEffect(() => {
    if (conversationContext.appliedCode.length > 0) {
      setComposerMode('edit');
    }
  }, [conversationContext.appliedCode.length]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const codeDisplayRef = useRef<HTMLDivElement>(null);

  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({
    stage: null
  });

  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>({
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

  // Keep-alive effect: ping sandbox periodically during active builds to prevent timeout
  useEffect(() => {
    if (!kanbanBuildActive && !generationProgress.isGenerating) return;
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
  }, [kanbanBuildActive, generationProgress.isGenerating, sandboxData?.sandboxId]);

  // Handle sandbox expiration - auto-recreate if needed
  useEffect(() => {
    if (!sandboxExpired) return;

    const handleExpiredSandbox = async () => {
      console.log('[sandbox-expired] Detected expired sandbox, attempting to recreate...');
      setSandboxData(null);
      setSandboxExpired(false);
      
      // Create new sandbox
      const newSandbox = await createSandbox(true);
      if (newSandbox) {
        addChatMessage('Sandbox was recreated after expiration. Please retry your last action.', 'system');
      }
    };

    handleExpiredSandbox();
  }, [sandboxExpired]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = (text: string, active: boolean) => {
    setStatus({ text, active });
  };

  const log = (message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content: string, type: GenerationChatMessage['type'], metadata?: GenerationChatMessage['metadata']) => {
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

  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();

      if (data.sandboxStopped) {
        console.log('[checkSandboxStatus] Sandbox stopped, clearing state and creating new one');
        setSandboxData(null);
        updateStatus('Sandbox stopped - creating new one...', false);
        
        // Clear old sandbox ID from URL
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('sandbox');
        router.replace(`/generation?${newParams.toString()}`, { scroll: false });
        
        await createSandbox(true);
        return;
      }

      if (data.active && data.healthy && data.sandboxData) {
        console.log('[checkSandboxStatus] Setting sandboxData from API:', data.sandboxData);
        setSandboxData(data.sandboxData);
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

  const planBuild = async (prompt: string) => {
    setIsPlanning(true);
    kanban.setTickets([]);
    kanban.setPlan(null);

    try {
      const response = await fetch('/api/plan-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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
                kanban.setPlan(data.plan);
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

  const handleComposerSubmit = async (mode: GenerationComposerMode) => {
    // Keep the UI focused on the plan as soon as a user starts a new build/clone.
    if (mode === 'build') {
      const prompt = buildPromptDraft.trim();
      if (!prompt) return;
      setHasInitialSubmission(true);
      setComposerMode('build');
      setActiveTab('kanban');
      await planBuild(prompt);
      setBuildPromptDraft('');
      return;
    }

    if (mode === 'clone') {
      let url = cloneUrlDraft.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      setHasInitialSubmission(true);
      setComposerMode('clone');
      setActiveTab('kanban');

      const prompt = `Clone and recreate the website at ${url}. Style preference: Minimalist.`;
      await planBuild(prompt);
      setCloneUrlDraft('');
      return;
    }

    // Edit mode – reuse the existing generation/apply pipeline.
    if (!aiChatInput.trim()) return;
    setHasInitialSubmission(true);
    await sendChatMessage();
  };

  const handleStartKanbanBuild = async () => {
    const backlogTickets = kanban.tickets.filter(t => t.status === 'backlog');
    const awaitingInputTickets = kanban.tickets.filter(t => t.status === 'awaiting_input');

    if (backlogTickets.length === 0 && awaitingInputTickets.length === 0) return;

    if (awaitingInputTickets.length > 0 && backlogTickets.length > 0) {
      addChatMessage(`${awaitingInputTickets.length} task(s) require input and will be skipped. Building ${backlogTickets.length} ready task(s).`, 'system');
    } else if (awaitingInputTickets.length > 0 && backlogTickets.length === 0) {
      addChatMessage(`${awaitingInputTickets.length} task(s) require input before building. Please provide the required credentials/API keys.`, 'system');
      return;
    }

    setKanbanBuildActive(true);
    kanban.setIsPaused(false);

    // Ensure sandbox exists before proceeding
    if (!sandboxData) {
      const newSandbox = await createSandbox(true);
      if (!newSandbox && !sandboxData) {
        setKanbanBuildActive(false);
        addChatMessage('❌ Failed to create sandbox. Please try again or refresh the page.', 'error');
        return;
      }
    }

    // Mark all backlog tickets as generating at once
    backlogTickets.forEach(ticket => {
      kanban.updateTicketStatus(ticket.id, 'generating');
    });

    // Build combined prompt from all tickets
    const ticketDescriptions = backlogTickets.map((ticket, idx) => {
      let desc = `${idx + 1}. ${ticket.title}: ${ticket.description}`;
      if (ticket.userInputs && Object.keys(ticket.userInputs).length > 0) {
        desc += `\n   Credentials: ${Object.entries(ticket.userInputs).map(([k, v]) => `${k}=${v}`).join(', ')}`;
      }
      return desc;
    }).join('\n');

    const combinedPrompt = `Build a complete application with ALL of the following features simultaneously:

FEATURES TO BUILD:
${ticketDescriptions}

Requirements:
- Generate ALL files needed for ALL features in a single response
- Use modern React with TypeScript and Tailwind CSS
- Create a cohesive, production-ready application
- Ensure all components work together seamlessly`;

    try {
      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: combinedPrompt,
          model: aiModel,
          context: { sandboxId: sandboxData?.sandboxId },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Generation failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      const completedFiles = new Set<string>();

      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: true,
        status: `Building ${backlogTickets.length} features...`,
        streamedCode: '',
        files: [],
      }));

      // Start build tracker
      buildTracker.startBuild(`Building ${backlogTickets.length} features`);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'stream' && data.raw) {
                generatedCode += data.text;

                // Use build tracker to process streamed code and update tickets
                buildTracker.processStreamedCode(generatedCode);

                // Update overall progress
                const progress = Math.min(85, (generatedCode.length / 10000) * 100);
                backlogTickets.forEach(ticket => {
                  kanban.updateTicketProgress(ticket.id, progress);
                });

                setGenerationProgress(prev => ({
                  ...prev,
                  streamedCode: generatedCode,
                }));

                // Parse files for UI display
                const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
                const parsedFiles: Array<{ path: string; content: string; type: string; completed: boolean }> = [];
                let match;
                while ((match = fileRegex.exec(generatedCode)) !== null) {
                  const filePath = match[1];
                  const content = match[2];
                  const ext = filePath.split('.').pop() || '';
                  const hasClosingTag = match[0].includes('</file>');
                  parsedFiles.push({ path: filePath, content, type: ext, completed: hasClosingTag });
                  
                  // Mark tickets as progressing based on file types
                  if (hasClosingTag && !completedFiles.has(filePath)) {
                    completedFiles.add(filePath);
                  }
                }
                if (parsedFiles.length > 0) {
                  setGenerationProgress(prev => ({ ...prev, files: parsedFiles }));
                }
              } else if (data.type === 'complete') {
                generatedCode = data.generatedCode || generatedCode;
              }
            } catch (e) {
              console.debug('[stream-parse] Partial JSON chunk, continuing...', e);
            }
          }
        }
      }

      // Mark all as applying
      buildTracker.markApplying();
      backlogTickets.forEach(ticket => {
        kanban.updateTicketStatus(ticket.id, 'applying');
        kanban.updateTicketProgress(ticket.id, 90);
      });
      setGenerationProgress(prev => ({ ...prev, status: 'Applying code...' }));

      // Switch to preview as soon as we start applying code
      setActiveTab('preview');

      await applyGeneratedCode(generatedCode, false);

      // Mark all as done
      buildTracker.markCompleted();
      const allFiles = Array.from(generatedCode.matchAll(/<file path="([^"]+)">/g)).map(m => m[1]);
      backlogTickets.forEach(ticket => {
        kanban.updateTicketFiles(ticket.id, allFiles);
        kanban.updateTicketStatus(ticket.id, 'done');
        kanban.updateTicketProgress(ticket.id, 100);
      });

      setKanbanBuildActive(false);
      setGenerationProgress(prev => ({ ...prev, isGenerating: false, status: 'Build complete' }));

    } catch (error: any) {
      buildTracker.markFailed(error.message);
      backlogTickets.forEach(ticket => {
        kanban.updateTicketStatus(ticket.id, 'failed', error.message);
      });
      setKanbanBuildActive(false);
      setGenerationProgress(prev => ({ ...prev, isGenerating: false, status: `Failed: ${error.message}` }));
      addChatMessage(`❌ Build failed: ${error.message}`, 'error');
    }
  };

  const sandboxCreationRef = useRef<boolean>(false);

  const createSandbox = async (fromHomeScreen = false, retryCount = 0) => {
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
        body: JSON.stringify({})
      });

      const data = await response.json();
      console.log('[createSandbox] Response data:', data);

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
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[createSandbox] Error:', error);
      sandboxCreationRef.current = false; // Reset to allow retry

      // Auto-retry on failure
      if (retryCount < MAX_RETRIES) {
        console.log(`[createSandbox] Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        updateStatus(`Connection failed. Retrying (${retryCount + 1}/${MAX_RETRIES})...`, false);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return createSandbox(fromHomeScreen, retryCount + 1);
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

  const applyGeneratedCode = async (code: string, isEdit: boolean = false, overrideSandboxData?: SandboxData) => {
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

        if (data.success) {
          const { results } = data;

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
      } else {
        // If no final data was received, still close loading
        addChatMessage('Code application may have partially succeeded. Check the preview.', 'system');
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, 'error');
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

  const fetchSandboxLogs = async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const response = await fetch('/api/sandbox-logs', { method: 'GET' });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to fetch logs (HTTP ${response.status})`);
      }

      setSandboxLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setLogsError(message);
      setSandboxLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    await fetchSandboxLogs();
  };

  const copyLogsToClipboard = async () => {
    try {
      await navigator.clipboard.writeText((sandboxLogs || []).join('\n'));
    } catch {
      // fallback best-effort
      const text = (sandboxLogs || []).join('\n');
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
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
    if (activeTab === 'code' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
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

            {/* Refresh button */}
            <button
              onClick={() => {
                if (iframeRef.current && sandboxData?.url) {
                  console.log('[Manual Refresh] Forcing iframe reload...');
                  const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
                  iframeRef.current.src = newSrc;
                }
              }}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
              title="Refresh sandbox"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
              <p className="text-sm">Use Build, Clone, or Edit to get started</p>
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
          onMoveTicket={kanban.moveTicket}
          onReorderTicket={kanban.reorderTicket}
          onAddTicket={kanban.addTicket}
          onSubmitInput={kanban.submitTicketInput}
          onBuildSingleTicket={kanban.buildSingleTicket}
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

  const startNewBuild = async () => {
    if (newBuildBusy) return;
    setNewBuildBusy(true);
    setNewBuildConfirmOpen(false);

    try {
      await fetch('/api/conversation-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
    } catch (e) {
      console.warn('[startNewBuild] Failed to reset server conversation state:', e);
    }

    buildTracker.stopTracking();

    // Reset planner/build state
    setHasInitialSubmission(false);
    setIsPlanning(false);
    setKanbanBuildActive(false);
    setActiveTab('kanban');
    kanban.setIsPaused(false);
    kanban.setCurrentTicketId(null);
    kanban.setTickets([]);
    kanban.setPlan(null);

    // Reset unified composer
    setComposerMode('build');
    setBuildPromptDraft('');
    setCloneUrlDraft('');
    setAiChatInput('');

    // Reset activity + generation state
    setChatMessages([{
      content: 'New build started. Describe what you want to build.',
      type: 'system',
      timestamp: new Date()
    }]);
    setConversationContext({
      scrapedWebsites: [],
      generatedComponents: [],
      appliedCode: [],
      currentProject: '',
      lastGeneratedCode: undefined
    });
    setPromptInput('');
    setGenerationProgress({
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
    setCodeApplicationState({ stage: null });

    // Reset explorer cache
    setSandboxFiles({});
    setFileStructure('');
    setSelectedFile(null);
    setExpandedFolders(new Set(['app', 'src', 'src/components']));

    // Reset misc UI state
    setLoadingStage(null);
    setIsStartingNewGeneration(false);
    setScreenshotError(null);
    setIsPreparingDesign(false);
    setUrlStatus([]);

    // Clear any pending auto-start flags
    try {
      sessionStorage.removeItem('autoStart');
      sessionStorage.removeItem('promptMode');
      sessionStorage.removeItem('pendingBuildPrompt');
      sessionStorage.removeItem('websiteScreenshot');
      sessionStorage.removeItem('buildFromPrompt');
      sessionStorage.removeItem('buildPrompt');
      sessionStorage.removeItem('selectedUIOption');
    } catch {}

    setNewBuildBusy(false);
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
      setActiveTab('code');

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

      setActiveTab('code');

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
      setActiveTab('code');

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
          setActiveTab('code');
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
              onClick={() => setNewBuildConfirmOpen(true)}
              className="px-3 py-2 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
              title="New build"
              disabled={newBuildBusy}
            >
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20v-6h-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8a8 8 0 00-14.5-3.5L4 10" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a8 8 0 0014.5 3.5L20 14" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">New build</span>
              </div>
            </button>
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
            <LoginButton className="text-sm" />
            <UserMenu />
            {versioning.saveStatus.local !== 'idle' && (
              <SaveStatusIndicator status={versioning.saveStatus} />
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <GenerationLeftPanel
            composerMode={composerMode}
            setComposerMode={setComposerMode}
            buildPromptDraft={buildPromptDraft}
            setBuildPromptDraft={setBuildPromptDraft}
            cloneUrlDraft={cloneUrlDraft}
            setCloneUrlDraft={setCloneUrlDraft}
            editDraft={aiChatInput}
            setEditDraft={setAiChatInput}
            onSubmitComposer={handleComposerSubmit}
            composerDisabled={loading || generationProgress.isGenerating || isPlanning}
            isPlanning={isPlanning}
            isBuilding={kanbanBuildActive}
            tickets={kanban.tickets}
            onOpenKanban={() => setActiveTab('kanban')}
            onStartBuild={handleStartKanbanBuild}
            conversationContext={conversationContext}
            screenshotCollapsed={screenshotCollapsed}
            onToggleScreenshotCollapsed={() => setScreenshotCollapsed(!screenshotCollapsed)}
            chatMessages={chatMessages}
            chatMessagesRef={chatMessagesRef}
            generationProgress={generationProgress}
            codeApplicationState={codeApplicationState}
          />

          {/* Right Panel - Preview or Generation (2/3 of remaining width) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-4 pb-4 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Toggle-style Code/View switcher */}
                <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                  <button
                    onClick={() => setActiveTab('code')}
                    className={`px-3 py-1 rounded transition-all text-xs font-medium ${activeTab === 'code'
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
                {activeTab === 'code' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                  <div className="text-gray-500 text-xs font-medium">
                    {generationProgress.files.length} files generated
                  </div>
                )}

                {/* Live Code Generation Status */}
                {activeTab === 'code' && generationProgress.isGenerating && (
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

                {/* Logs / troubleshooting */}
                {sandboxData && (
                  <button
                    onClick={openLogs}
                    title="Open sandbox logs"
                    className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative"
                  >
                    {logsLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                      </svg>
                    )}
                    {(chatMessages.some(m => m.type === 'error') ||
                      (generationProgress.status && generationProgress.status.toLowerCase().includes('failed'))) && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>
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
            </div>
          )}
        </div>

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

        {/* Sandbox Logs Modal */}
        <Dialog
          open={logsOpen}
          onOpenChange={(open) => {
            setLogsOpen(open);
            if (open) {
              void fetchSandboxLogs();
            }
          }}
        >
          <DialogContent className="max-w-[900px] p-0">
            <div className="p-24 border-b border-border-faint">
              <DialogHeader>
                <DialogTitle>Sandbox logs</DialogTitle>
                <DialogDescription>
                  Vite process status and recent logs from the sandbox. Use this when preview fails to load or the build
                  hits runtime errors.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-24">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-12">
                <div className="flex items-center gap-8">
                  <button
                    onClick={fetchSandboxLogs}
                    disabled={logsLoading}
                    className="px-3 py-2 text-sm rounded-10 border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {logsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button
                    onClick={copyLogsToClipboard}
                    disabled={logsLoading || sandboxLogs.length === 0}
                    className="px-3 py-2 text-sm rounded-10 border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Copy
                  </button>
                  <button
                    onClick={restartViteServer}
                    className="px-3 py-2 text-sm rounded-10 border border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                  >
                    Restart Vite
                  </button>
                </div>

                <div className="flex items-center gap-8">
                  {sandboxData?.url && (
                    <a
                      href={sandboxData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Open preview
                    </a>
                  )}
                </div>
              </div>

              {logsError && (
                <div className="mb-12 p-10 rounded-12 border border-red-200 bg-red-50 text-sm text-red-700">
                  {logsError}
                </div>
              )}

              <div className="rounded-12 border border-gray-200 bg-gray-900 text-gray-100 overflow-hidden">
                <pre className="p-12 text-[12px] leading-5 max-h-[60vh] overflow-auto whitespace-pre-wrap">
                  {sandboxLogs.length > 0 ? sandboxLogs.join('\n') : 'No logs available.'}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* New build confirmation */}
        <Dialog open={newBuildConfirmOpen} onOpenChange={setNewBuildConfirmOpen}>
          <DialogContent>
            <div className="p-24 border-b border-border-faint">
              <DialogHeader>
                <DialogTitle>Start a new build?</DialogTitle>
                <DialogDescription>
                  This clears the current plan, activity log, and editor state. Your sandbox stays running.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-24">
              <DialogFooter className="gap-8 sm:gap-8">
                <Button
                  variant="secondary"
                  onClick={() => setNewBuildConfirmOpen(false)}
                  disabled={newBuildBusy}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  isLoading={newBuildBusy}
                  loadingLabel="Starting new build…"
                  onClick={startNewBuild}
                >
                  Start new build
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

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