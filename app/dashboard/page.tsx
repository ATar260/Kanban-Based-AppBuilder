'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const isAuthEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

interface Project {
  id: string;
  name: string;
  description: string | null;
  sandboxId: string | null;
  sandboxUrl: string | null;
  mode: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function useOptionalSession() {
  try {
    const session = useSession();
    return session || { data: null, status: 'unauthenticated' as const };
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

export default function DashboardPage() {
  const { data: session, status } = useOptionalSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isAuthEnabled) {
      router.push('/generation');
      return;
    }
    if (status === 'authenticated') {
      loadProjects();
    } else if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard');
    }
  }, [status, router]);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/generation?project=${data.project.id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProjects(projects.filter(p => p.id !== projectId));
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-white border-b border-border-faint">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-semibold text-accent-black">
              Paynto A.I.
            </Link>
            <span className="text-black-alpha-24">/</span>
            <span className="text-black-alpha-72">My Projects</span>
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm text-black-alpha-72">{session?.user?.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-accent-black">My Projects</h1>
            <p className="text-black-alpha-72 mt-1">Manage and continue your AI-built applications</p>
          </div>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-heat-100 hover:bg-heat-200 text-white rounded-10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-16 border border-border-faint p-12 text-center">
            <div className="w-16 h-16 bg-black-alpha-4 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black-alpha-48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-accent-black mb-2">No projects yet</h3>
            <p className="text-black-alpha-72 mb-6">Create your first AI-powered application</p>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-heat-100 hover:bg-heat-200 text-white rounded-10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-16 border border-border-faint overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-black-alpha-4 relative">
                  {project.sandboxUrl ? (
                    <iframe
                      src={project.sandboxUrl}
                      className="w-full h-full border-none pointer-events-none"
                      title={project.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-black-alpha-48">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      project.mode === 'clone' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {project.mode === 'clone' ? 'Clone' : 'Prompt'}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-accent-black mb-1">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-black-alpha-72 mb-3 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-black-alpha-48">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/generation?project=${project.id}`}
                        className="px-3 py-1.5 text-sm bg-heat-100 hover:bg-heat-200 text-white rounded-10 transition-colors"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-1.5 text-black-alpha-48 hover:text-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-border-faint rounded-16 shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border-faint flex items-center justify-between">
              <h2 className="text-lg font-semibold text-accent-black">New Project</h2>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-black-alpha-48 hover:text-black-alpha-72"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-black-alpha-72 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My Awesome App"
                  className="w-full px-3 py-2 border border-gray-200 rounded-10 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 bg-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-black-alpha-72 mb-1">Description (optional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="A brief description of your project"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-10 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 resize-none bg-white"
                />
              </div>
              <button
                onClick={handleCreateProject}
                disabled={isCreating || !newProjectName.trim()}
                className="w-full py-2.5 bg-heat-100 hover:bg-heat-200 text-white rounded-10 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
