export type TemplateTarget = 'vite' | 'next';

// mock: always works immediately with seeded demo data
// real_optional: mock by default, can be upgraded to real DB when credentials are provided
// real_required: blocks build until credentials are provided
export type DataMode = 'mock' | 'real_optional' | 'real_required';

export type ThemePreset =
  | 'modern_light'
  | 'modern_dark'
  | 'fintech_dark'
  | 'playful_light'
  | 'editorial_light';

export type ThemeAccent = 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';

export interface BlueprintTheme {
  /**
   * A high-level design system preset. Used to keep the app visually consistent end-to-end.
   * This should be chosen based on the user's request ("vibe").
   */
  preset: ThemePreset;
  /**
   * Primary accent color used for CTAs/highlights.
   */
  accent: ThemeAccent;
  /**
   * 2-5 words describing the intended vibe (e.g., "sleek, premium, minimal").
   * Helpful for the generator to keep UI consistent.
   */
  vibe?: string;
}

export type RouteKind = 'page' | 'section';

export interface BlueprintRoute {
  /**
   * Stable identifier used for cross-references in tickets/flows/navigation.
   * Should be unique within the blueprint.
   */
  id: string;
  kind: RouteKind;
  /**
   * For pages: "/dashboard"
   * For sections: "#features"
   */
  path: string;
  title: string;
  description?: string;
  navLabel?: string;
  requiresAuth?: boolean;
}

export interface BlueprintNavItem {
  label: string;
  routeId: string;
}

export interface BlueprintNavigation {
  items: BlueprintNavItem[];
}

export interface BlueprintEntityField {
  name: string;
  type: string;
  required?: boolean;
}

export interface BlueprintEntity {
  name: string;
  description?: string;
  fields: BlueprintEntityField[];
  seedCount?: number;
}

export interface BlueprintFlow {
  id: string;
  name: string;
  description: string;
  /**
   * Human-readable steps to describe what “working” means for this flow.
   * Used by quality gates and smoke tests.
   */
  steps: string[];
  routeIds?: string[];
}

export interface BuildBlueprint {
  templateTarget: TemplateTarget;
  dataMode: DataMode;
  theme?: BlueprintTheme;
  routes: BlueprintRoute[];
  navigation: BlueprintNavigation;
  entities?: BlueprintEntity[];
  flows?: BlueprintFlow[];
}


