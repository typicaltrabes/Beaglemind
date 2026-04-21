'use client';

import Link from 'next/link';
import { useRunStore } from '@/lib/stores/run-store';
import { Badge } from '@/components/ui/badge';
import { MessageCircleQuestionIcon } from 'lucide-react';

export function QuestionQueue() {
  const unansweredQuestions = useRunStore((s) => s.unansweredQuestions);

  if (unansweredQuestions.length === 0) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2">
          <MessageCircleQuestionIcon className="size-4 text-gray-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Questions
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-600">No pending questions</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircleQuestionIcon className="size-4 text-amber-500" />
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          Questions
        </span>
        <Badge variant="default" className="ml-auto bg-amber-600 text-white">
          {unansweredQuestions.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-1">
        {unansweredQuestions.map((q) => {
          const projectId = q.content.projectId as string | undefined;
          const runId = q.runId;
          const href =
            projectId && runId
              ? `/projects/${projectId}/runs/${runId}`
              : '#';

          return (
            <Link
              key={q.sequenceNumber}
              href={href}
              className="rounded-md px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="mb-0.5 block font-medium text-amber-400">
                {q.agentId || 'Agent'}
              </span>
              <span className="line-clamp-2">
                {typeof q.content.text === 'string'
                  ? q.content.text
                  : typeof q.content === 'string'
                    ? q.content
                    : 'Question pending'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
