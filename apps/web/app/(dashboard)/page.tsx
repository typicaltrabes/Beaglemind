'use client';

import { useProjects } from '@/lib/hooks/use-projects';
import { Breadcrumb } from '@/components/breadcrumb';
import { FolderIcon, RocketIcon } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) {
    return (
      <>
        <Breadcrumb trail={["BEAGLELABS", "DASHBOARD"]} />
        <div className="flex min-h-[calc(100vh-65px)] items-center justify-center">
          <p className="text-gray-400">Loading projects...</p>
        </div>
      </>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <>
        <Breadcrumb trail={["BEAGLELABS", "DASHBOARD"]} />
        <div className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center gap-4">
          <RocketIcon className="size-12 text-gray-600" />
          <h2 className="text-xl font-semibold text-white">
            Welcome to Beagle Agent Console
          </h2>
          <p className="max-w-md text-center text-gray-400">
            Create your first project using the sidebar to start a research
            sprint.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb trail={["BEAGLELABS", "DASHBOARD"]} />
      <div className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center gap-4">
        <FolderIcon className="size-12 text-gray-600" />
        <h2 className="text-xl font-semibold text-white">
          Select a project
        </h2>
        <p className="text-gray-400">
          Choose a project from the sidebar or create a new one to get started.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {projects.map((project: { id: string; name: string }) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:text-white"
            >
              {project.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
