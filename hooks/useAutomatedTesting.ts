import { useState, useCallback } from 'react';

export interface TestResults {
  success: boolean;
  timestamp: string;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
  tests: {
    playwright?: {
      success: boolean;
      passed: number;
      failed: number;
      total: number;
      details?: any[];
    };
    accessibility?: {
      success: boolean;
      passed: number;
      failed: number;
      violations: Array<{
        id: string;
        impact: string;
        description: string;
        nodes: number;
      }>;
    };
    lighthouse?: {
      success: boolean;
      scores: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
      };
      audits?: {
        lcp?: string;
        fid?: string;
        cls?: string;
      };
    };
    console?: {
      success: boolean;
      errorCount: number;
      errors: string[];
    };
  };
}

export interface AutoFixResults {
  finalStatus: 'passed' | 'max_attempts_reached' | 'no_failures_detected' | 'no_fixes_generated' | 'pending';
  totalAttempts: number;
  message?: string;
  attempts: Array<{
    attempt: number;
    testResults: {
      passed: number;
      failed: number;
      total: number;
    };
    fixesApplied?: Array<{
      file: string;
      description: string;
    }>;
  }>;
}

export function useAutomatedTesting() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [autoFixResults, setAutoFixResults] = useState<AutoFixResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateTests = useCallback(async (testTypes: string[] = ['smoke', 'navigation', 'forms']) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testTypes })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate tests');
      }
      
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const runTests = useCallback(async (testType: 'all' | 'playwright' | 'accessibility' | 'lighthouse' | 'console' = 'all') => {
    setIsRunning(true);
    setError(null);
    
    try {
      const response = await fetch('/api/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType })
      });
      
      const data = await response.json();
      setTestResults(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const autoFixTests = useCallback(async (maxAttempts: number = 3) => {
    setIsAutoFixing(true);
    setError(null);
    setAutoFixResults(null);
    
    try {
      const response = await fetch('/api/auto-fix-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAttempts })
      });
      
      const data = await response.json();
      setAutoFixResults(data);
      
      if (data.finalStatus === 'passed') {
        const finalResults = await runTests('all');
        setTestResults(finalResults);
      }
      
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsAutoFixing(false);
    }
  }, [runTests]);

  const runFullTestCycle = useCallback(async () => {
    await generateTests();
    
    const initialResults = await runTests('all');
    
    if (!initialResults.success) {
      const fixResults = await autoFixTests(3);
      return {
        testResults: testResults,
        autoFixResults: fixResults,
        finalSuccess: fixResults.finalStatus === 'passed'
      };
    }
    
    return {
      testResults: initialResults,
      autoFixResults: null,
      finalSuccess: true
    };
  }, [generateTests, runTests, autoFixTests, testResults]);

  const getQualityScore = useCallback((): number => {
    if (!testResults) return 0;
    
    let score = 0;
    let weights = 0;

    if (testResults.tests.playwright) {
      const pw = testResults.tests.playwright;
      if (pw.total > 0) {
        score += (pw.passed / pw.total) * 30;
        weights += 30;
      }
    }

    if (testResults.tests.accessibility) {
      const a11y = testResults.tests.accessibility;
      score += a11y.success ? 25 : Math.max(0, 25 - a11y.violations.length * 5);
      weights += 25;
    }

    if (testResults.tests.lighthouse?.scores) {
      const lh = testResults.tests.lighthouse.scores;
      score += (lh.performance / 100) * 15;
      score += (lh.accessibility / 100) * 15;
      score += (lh.bestPractices / 100) * 10;
      score += (lh.seo / 100) * 5;
      weights += 45;
    }

    return weights > 0 ? Math.round((score / weights) * 100) : 0;
  }, [testResults]);

  return {
    generateTests,
    runTests,
    autoFixTests,
    runFullTestCycle,
    getQualityScore,
    testResults,
    autoFixResults,
    isGenerating,
    isRunning,
    isAutoFixing,
    isLoading: isGenerating || isRunning || isAutoFixing,
    error
  };
}
