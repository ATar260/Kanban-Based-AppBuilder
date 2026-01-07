'use client';

import { ReviewResult, ReviewIssue } from '@/hooks/useBugbot';

interface CodeReviewPanelProps {
  result: ReviewResult;
  onDismiss: () => void;
  onApprove?: () => void;
  className?: string;
}

export default function CodeReviewPanel({
  result,
  onDismiss,
  onApprove,
  className = '',
}: CodeReviewPanelProps) {
  const severityColors = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const severityIcons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const typeIcons: Record<string, string> = {
    bug: '🐛',
    security: '🔒',
    practice: '📋',
    performance: '⚡',
    quality: '✨',
  };

  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;
  const infoCount = result.issues.filter(i => i.severity === 'info').length;

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className={`px-4 py-3 ${result.passed ? 'bg-green-50' : 'bg-red-50'} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{result.passed ? '✅' : '🚨'}</span>
            <div>
              <h3 className="font-semibold text-gray-900">
                {result.passed ? 'Review Passed' : 'Issues Found'}
              </h3>
              <p className="text-xs text-gray-600">{result.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                result.score >= 80 ? 'text-green-600' :
                result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {result.score}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Score</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-3">
          {errorCount > 0 && (
            <span className="text-xs text-red-600 font-medium">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs text-yellow-600 font-medium">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {infoCount > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {infoCount} suggestion{infoCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {result.issues.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto">
          <div className="p-2 space-y-2">
            {result.issues.map((issue, idx) => (
              <IssueCard key={idx} issue={issue} typeIcons={typeIcons} severityColors={severityColors} severityIcons={severityIcons} />
            ))}
          </div>
        </div>
      )}

      {result.improvements.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Suggested Improvements</h4>
          <ul className="space-y-1">
            {result.improvements.map((imp, idx) => (
              <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                <span className="text-green-500">→</span>
                {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3 border-t flex justify-end gap-2">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Dismiss
        </button>
        {onApprove && (
          <button
            onClick={onApprove}
            className={`px-3 py-1.5 text-xs font-medium text-white rounded transition-colors ${
              result.passed
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {result.passed ? 'Approve & Continue' : 'Approve anyway'}
          </button>
        )}
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  typeIcons,
  severityColors,
  severityIcons,
}: {
  issue: ReviewIssue;
  typeIcons: Record<string, string>;
  severityColors: Record<string, string>;
  severityIcons: Record<string, string>;
}) {
  return (
    <div className={`p-2.5 rounded border ${severityColors[issue.severity]}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm flex-shrink-0">{severityIcons[issue.severity]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{issue.message}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-white/50 rounded">
              {typeIcons[issue.type] || '📝'} {issue.type}
            </span>
          </div>
          <div className="text-[10px] opacity-75 mt-0.5">
            {issue.file}
            {issue.line && `:${issue.line}`}
          </div>
          {issue.suggestion && (
            <div className="text-[10px] mt-1 pt-1 border-t border-current/20">
              💡 {issue.suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
