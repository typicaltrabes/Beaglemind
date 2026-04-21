'use client';

import { useSession } from '@/lib/auth-client';
import { useRunStore } from '@/lib/stores/run-store';
import { QuestionCard } from '@/components/mobile/question-card';
import { DigestView } from '@/components/mobile/digest-view';
import { CheckCircle2 } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name: string | undefined): string {
  if (!name) return '';
  return name.split(' ')[0] ?? name;
}

export default function MobilePage() {
  const { data: session } = useSession();
  const unansweredQuestions = useRunStore((s) => s.unansweredQuestions);

  const greeting = getGreeting();
  const firstName = getFirstName(session?.user?.name);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Greeting */}
      <h1 className="mb-6 text-2xl font-bold text-white">
        {greeting}
        {firstName ? `, ${firstName}` : ''}
      </h1>

      {/* Question Queue */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
          Pending Questions
        </h2>

        {unansweredQuestions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-card p-4">
            <CheckCircle2 className="size-5 text-green-500" />
            <span className="text-sm text-gray-400">No pending questions</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unansweredQuestions.map((q) => (
              <QuestionCard key={q.sequenceNumber} question={q} />
            ))}
          </div>
        )}
      </section>

      {/* Overnight Digest */}
      <DigestView />
    </div>
  );
}
