import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          name?: string | null;
          image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          name?: string | null;
          image?: string | null;
          updated_at?: string;
        };
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          provider: string;
          provider_account_id: string;
          refresh_token: string | null;
          access_token: string | null;
          expires_at: number | null;
          token_type: string | null;
          scope: string | null;
          id_token: string | null;
          session_state: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          provider: string;
          provider_account_id: string;
          refresh_token?: string | null;
          access_token?: string | null;
          expires_at?: number | null;
          token_type?: string | null;
          scope?: string | null;
          id_token?: string | null;
          session_state?: string | null;
        };
        Update: {
          refresh_token?: string | null;
          access_token?: string | null;
          expires_at?: number | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          session_token: string;
          user_id: string;
          expires: string;
        };
        Insert: {
          id?: string;
          session_token: string;
          user_id: string;
          expires: string;
        };
        Update: {
          expires?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          sandbox_id: string | null;
          sandbox_url: string | null;
          mode: string;
          source_url: string | null;
          github_repo: string | null;
          github_branch: string | null;
          last_commit_sha: string | null;
          last_commit_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          sandbox_id?: string | null;
          sandbox_url?: string | null;
          mode?: string;
          source_url?: string | null;
          github_repo?: string | null;
          github_branch?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          sandbox_id?: string | null;
          sandbox_url?: string | null;
          github_repo?: string | null;
          github_branch?: string | null;
          last_commit_sha?: string | null;
          last_commit_at?: string | null;
          updated_at?: string;
        };
      };
      versions: {
        Row: {
          id: string;
          project_id: string;
          version_number: number;
          name: string;
          description: string | null;
          trigger: string;
          ticket_id: string | null;
          ticket_title: string | null;
          files_json: string;
          packages_json: string | null;
          kanban_json: string | null;
          file_count: number;
          total_size: number;
          git_commit_sha: string | null;
          git_commit_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_number: number;
          name: string;
          description?: string | null;
          trigger: string;
          ticket_id?: string | null;
          ticket_title?: string | null;
          files_json: string;
          packages_json?: string | null;
          kanban_json?: string | null;
          file_count?: number;
          total_size?: number;
          git_commit_sha?: string | null;
          git_commit_url?: string | null;
        };
        Update: {
          git_commit_sha?: string | null;
          git_commit_url?: string | null;
        };
      };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseAdmin = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
  : null;

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  
  const { data } = await (supabaseAdmin as any)
    .from('accounts')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'github')
    .single();
  
  return data?.access_token || null;
}
