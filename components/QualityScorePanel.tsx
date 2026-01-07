'use client';

import { useState } from 'react';
import { useAutomatedTesting, TestResults } from '@/hooks/useAutomatedTesting';
import { Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

export function QualityScorePanel() {
  const {
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
    isLoading,
    error
  } = useAutomatedTesting();

  const [expanded, setExpanded] = useState(false);

  const qualityScore = getQualityScore();

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-500/20';
    if (score >= 70) return 'bg-yellow-500/20';
    if (score >= 50) return 'bg-orange-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getScoreBg(qualityScore)}`}>
              <span className={`text-lg font-bold ${getScoreColor(qualityScore)}`}>
                {testResults ? qualityScore : '--'}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-white">Quality Score</h3>
              <p className="text-sm text-gray-400">
                {testResults 
                  ? `${testResults.summary.passed}/${testResults.summary.total} tests passing`
                  : 'Run tests to see score'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                runFullTestCycle();
              }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium text-white flex items-center gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : isRunning ? 'Testing...' : isAutoFixing ? 'Fixing...' : 'Run Tests'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {testResults && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ScoreCard 
                  label="Playwright" 
                  value={testResults.tests.playwright?.passed ?? 0}
                  total={testResults.tests.playwright?.total ?? 0}
                  type="ratio"
                />
                <ScoreCard 
                  label="Accessibility" 
                  value={testResults.tests.accessibility?.violations.length === 0 ? 100 : 
                    Math.max(0, 100 - (testResults.tests.accessibility?.violations.length ?? 0) * 10)}
                  type="score"
                />
                <ScoreCard 
                  label="Performance" 
                  value={testResults.tests.lighthouse?.scores.performance ?? 0}
                  type="score"
                />
                <ScoreCard 
                  label="Best Practices" 
                  value={testResults.tests.lighthouse?.scores.bestPractices ?? 0}
                  type="score"
                />
              </div>

              {testResults.tests.accessibility?.violations && 
               testResults.tests.accessibility.violations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">Accessibility Issues</h4>
                  <div className="space-y-1">
                    {testResults.tests.accessibility.violations.slice(0, 5).map((v, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-gray-900 rounded">
                        <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                          v.impact === 'critical' ? 'text-red-400' :
                          v.impact === 'serious' ? 'text-orange-400' : 'text-yellow-400'
                        }`} />
                        <div>
                          <span className="text-gray-300">{v.description}</span>
                          <span className="text-gray-500 ml-2">({v.nodes} elements)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResults.tests.console?.errors && 
               testResults.tests.console.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300">Console Errors</h4>
                  <div className="space-y-1">
                    {testResults.tests.console.errors.slice(0, 3).map((err, i) => (
                      <div key={i} className="text-sm p-2 bg-gray-900 rounded text-red-400 font-mono truncate">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {autoFixResults && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300">Auto-Fix Results</h4>
              <div className={`p-3 rounded ${
                autoFixResults.finalStatus === 'passed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                <div className="flex items-center gap-2">
                  {autoFixResults.finalStatus === 'passed' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span className="text-sm">{autoFixResults.message}</span>
                </div>
                <p className="text-xs mt-1 opacity-75">
                  Completed in {autoFixResults.totalAttempts} attempt(s)
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => generateTests()}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm text-gray-300"
            >
              Generate Tests
            </button>
            <button
              onClick={() => runTests('all')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm text-gray-300"
            >
              Run Tests Only
            </button>
            <button
              onClick={() => autoFixTests(3)}
              disabled={isLoading || !testResults || testResults.success}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded text-sm text-gray-300"
            >
              Auto-Fix Issues
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ 
  label, 
  value, 
  total, 
  type 
}: { 
  label: string; 
  value: number; 
  total?: number; 
  type: 'score' | 'ratio';
}) {
  const getColor = () => {
    const pct = type === 'ratio' && total ? (value / total) * 100 : value;
    if (pct >= 90) return 'text-green-400';
    if (pct >= 70) return 'text-yellow-400';
    if (pct >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900 rounded p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${getColor()}`}>
        {type === 'ratio' ? `${value}/${total}` : `${value}%`}
      </p>
    </div>
  );
}
