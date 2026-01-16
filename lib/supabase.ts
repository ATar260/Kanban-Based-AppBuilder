import { createClient } from '@supabase/supabase-js';

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
          org_id: string | null;
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
          org_id?: string | null;
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
          org_id?: string | null;
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
      usage_monthly: {
        Row: {
          id: string;
          user_id: string;
          period: string; // YYYY-MM
          ai_generations: number;
          sandbox_seconds: number;
          last_sandbox_ping_at: string | null;
          last_sandbox_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period: string;
          ai_generations?: number;
          sandbox_seconds?: number;
          last_sandbox_ping_at?: string | null;
          last_sandbox_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ai_generations?: number;
          sandbox_seconds?: number;
          last_sandbox_ping_at?: string | null;
          last_sandbox_id?: string | null;
          updated_at?: string;
        };
      };
      e2b_template_bake_queue: {
        Row: {
          package_name: string;
          dep_type: string; // dependency | devDependency
          first_seen_at: string;
          last_seen_at: string;
          seen_count: number;
          status: string; // pending | baked | failed | ignored
          last_error: string | null;
          baked_at: string | null;
        };
        Insert: {
          package_name: string;
          dep_type?: string;
          first_seen_at?: string;
          last_seen_at?: string;
          seen_count?: number;
          status?: string;
          last_error?: string | null;
          baked_at?: string | null;
        };
        Update: {
          dep_type?: string;
          last_seen_at?: string;
          seen_count?: number;
          status?: string;
          last_error?: string | null;
          baked_at?: string | null;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          image_url?: string | null;
          updated_at?: string;
        };
      };
      organization_memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: string;
          updated_at?: string;
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

export const supabaseAdmin = isSupabaseConfigured && supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey)
  : null;

export async function getGitHubToken(userId: string): Promise<string | null> {
  if (!supabaseAdmin || !userId) return null;
  
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('accounts')
      .select('access_token')
      .eq('user_id', userId)
      .eq('provider', 'github')
      .single();
    
    if (error) {
      console.error('[supabase] getGitHubToken error:', error.message);
      return null;
    }
    
    return data?.access_token ?? null;
  } catch (error) {
    console.error('[supabase] getGitHubToken failed:', error);
    return null;
  }
}
