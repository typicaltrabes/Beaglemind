'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { useAnswerQuestion } from '@/lib/hooks/use-run-actions';
import { CheckCircle2 } from 'lucide-react';

const AGENT_COLORS: Record<string, string> = {
  mo: 'text-amber-500',
  jarvis: 'text-teal-500',
};

const YES_NO_PATTERNS = [
  /^should\b/i,
  /^do you want\b/i,
  /^can we\b/i,
  /^is it ok\b/i,
  /^would you like\b/i,
  /^shall\b/i,
  /^do we\b/i,
  /^are you ok\b/i,
  /^confirm\b/i,
];

function isYesNoQuestion(text: string): boolean {
  return YES_NO_PATTERNS.some((p) => p.test(text.trim()));
}

function getQuestionText(question: HubEventEnvelope): string {
  if (typeof question.content.text === 'string') return question.content.text;
  if (typeof question.content === 'string') return question.content;
  return 'Question pending';
}

export function QuestionCard({ question }: { question: HubEventEnvelope }) {
  const [answered, setAnswered] = useState(false);
  const answerMutation = useAnswerQuestion();

  const text = getQuestionText(question);
  const yesNo = question.content.type === 'yes_no' || isYesNoQuestion(text);
  const projectId = question.content.projectId as string | undefined;
  const runId = question.runId;
  const questionId = (question.content.questionId as string) ?? String(question.sequenceNumber);
  const agentId = question.agentId || 'Agent';
  const agentColor = AGENT_COLORS[agentId.toLowerCase()] ?? 'text-blue-400';

  function handleAnswer(answer: string) {
    if (!runId) return;
    setAnswered(true);
    answerMutation.mutate({ runId, questionId, answer });
  }

  if (answered) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-card p-4 border-l-4 border-l-green-500 opacity-60 transition-opacity duration-500">
        <CheckCircle2 className="size-5 text-green-500" />
        <span className="text-sm text-gray-400">Answered</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-card p-4 border-l-4 border-l-amber-500">
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-sm font-semibold ${agentColor}`}>{agentId}</span>
        {projectId && runId && (
          <span className="ml-auto text-xs text-gray-500">Run</span>
        )}
      </div>
      <p className="mb-3 text-sm text-gray-200 leading-relaxed">{text}</p>

      {yesNo ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleAnswer('Yes')}
            disabled={answerMutation.isPending}
            className="flex-1 rounded-lg bg-green-600/20 px-4 py-3 text-sm font-medium text-green-400 transition-colors hover:bg-green-600/30 active:bg-green-600/40 disabled:opacity-50"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('No')}
            disabled={answerMutation.isPending}
            className="flex-1 rounded-lg bg-red-600/20 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30 active:bg-red-600/40 disabled:opacity-50"
          >
            No
          </button>
        </div>
      ) : (
        <Link
          href={projectId && runId ? `/projects/${projectId}/runs/${runId}` : '#'}
          className="block w-full rounded-lg bg-amber-600/20 px-4 py-3 text-center text-sm font-medium text-amber-400 transition-colors hover:bg-amber-600/30 active:bg-amber-600/40"
        >
          View & Answer
        </Link>
      )}
    </div>
  );
}
