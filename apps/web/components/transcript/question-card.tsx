'use client';

import { useState } from 'react';
import { useAnswerQuestion } from '@/lib/hooks/use-run-actions';
import { useRunStore } from '@/lib/stores/run-store';
import type { HubEventEnvelope } from '@beagle-console/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface QuestionCardProps {
  event: HubEventEnvelope;
  runId: string;
}

export function QuestionCard({ event, runId }: QuestionCardProps) {
  const [answer, setAnswer] = useState('');
  const answerQuestion = useAnswerQuestion();

  const content = event.content as {
    text: string;
    questionId: string;
    answer?: string;
  };

  const isAnswered = Boolean(content.answer);

  function handleSubmit() {
    if (!answer.trim()) return;

    // Optimistic update
    useRunStore.getState().updateQuestion(content.questionId, answer);

    answerQuestion.mutate({
      runId,
      questionId: content.questionId,
      answer: answer.trim(),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Card className="border-t-2 border-t-amber-500">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-amber-500">
          Question for you
        </CardTitle>
        <p className="text-xs text-muted-foreground">from {event.agentId}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{content.text}</p>

        {isAnswered ? (
          <div className="space-y-1">
            <p className="text-sm text-foreground rounded-md bg-muted/50 p-2">
              {content.answer}
            </p>
            <p className="text-xs text-muted-foreground">Answered</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              disabled={answerQuestion.isPending}
            />
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || answerQuestion.isPending}
              className="bg-amber-500 text-black hover:bg-amber-600"
            >
              {answerQuestion.isPending ? 'Sending...' : 'Answer'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
