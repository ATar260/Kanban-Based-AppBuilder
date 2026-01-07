import type { BuildBlueprint } from '@/types/build-blueprint';

export interface BlueprintValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    routesTotal: number;
    routesWithNav: number;
    flowsTotal: number;
  };
}

export function validateBlueprint(blueprint: BuildBlueprint | null | undefined): BlueprintValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!blueprint) {
    return {
      ok: false,
      errors: ['No blueprint available'],
      warnings: [],
      metrics: { routesTotal: 0, routesWithNav: 0, flowsTotal: 0 },
    };
  }

  const routeIds = new Set<string>();
  for (const r of blueprint.routes || []) {
    if (!r?.id) {
      errors.push('Route missing id');
      continue;
    }
    if (routeIds.has(r.id)) {
      errors.push(`Duplicate route id: ${r.id}`);
    }
    routeIds.add(r.id);

    if (!r.path || typeof r.path !== 'string') {
      errors.push(`Route ${r.id} missing path`);
    } else if (r.kind === 'page' && !r.path.startsWith('/')) {
      errors.push(`Route ${r.id} is page but path is not absolute: ${r.path}`);
    } else if (r.kind === 'section' && !r.path.startsWith('#')) {
      warnings.push(`Route ${r.id} is section but path does not start with '#': ${r.path}`);
    } else if (r.kind === 'section' && r.path.trim() === '#') {
      // In practice this is almost always a placeholder (like href="#") and not a real section id.
      errors.push(`Route ${r.id} has placeholder section path "#"`);
    }
  }

  const navItems = blueprint.navigation?.items || [];
  const navRouteIds = new Set(navItems.map(i => i.routeId));
  let routesWithNav = 0;
  for (const r of blueprint.routes || []) {
    if (navRouteIds.has(r.id)) routesWithNav += 1;
    else warnings.push(`Route missing from navigation: ${r.id}`);
  }

  for (const nav of navItems) {
    if (!routeIds.has(nav.routeId)) {
      errors.push(`Navigation references unknown routeId: ${nav.routeId}`);
    }
    if (!nav.label) warnings.push(`Navigation item for ${nav.routeId} missing label`);

    const target = (blueprint.routes || []).find(r => r.id === nav.routeId);
    if (target?.kind === 'section') {
      warnings.push(`Navigation item "${nav.label || nav.routeId}" points to a section route (${target.path}). Consider making this a page route for end-to-end navigation.`);
    }
  }

  const flowsTotal = blueprint.flows?.length || 0;
  for (const flow of blueprint.flows || []) {
    if (!flow.id) errors.push('Flow missing id');
    if (!flow.name) warnings.push(`Flow ${flow.id || '(unknown)'} missing name`);
    if (!Array.isArray(flow.steps) || flow.steps.length === 0) warnings.push(`Flow ${flow.id || '(unknown)'} has no steps`);
    if (flow.routeIds) {
      for (const rid of flow.routeIds) {
        if (!routeIds.has(rid)) warnings.push(`Flow ${flow.id} references unknown routeId: ${rid}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      routesTotal: blueprint.routes?.length || 0,
      routesWithNav,
      flowsTotal,
    },
  };
}


