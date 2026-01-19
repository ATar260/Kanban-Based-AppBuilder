import type { SandboxProvider } from '@/lib/sandbox/types';

const MARKER = '__PAYNTO_PREVIEW_GUARD__';

function buildInjectionScript(): string {
  // Intentionally tiny + dependency-free.
  // Never include secrets in error payloads.
  return `<!-- ${MARKER} -->
<script>
(() => {
  try {
    if (window.__PAYNTO_PREVIEW_GUARD_INSTALLED__) return;
    window.__PAYNTO_PREVIEW_GUARD_INSTALLED__ = true;

    const safeString = (x) => {
      try {
        if (typeof x === 'string') return x;
        if (x && typeof x.message === 'string') return x.message;
        return String(x);
      } catch {
        return 'unknown';
      }
    };

    const post = (type, data) => {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ __paynto: true, type, data }, '*');
        }
      } catch {}
    };

    const ensureOverlay = () => {
      const id = '__paynto_preview_guard_overlay__';
      let el = document.getElementById(id);
      if (el) return el;
      el = document.createElement('div');
      el.id = id;
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.zIndex = '2147483647';
      el.style.background = 'rgba(255,255,255,0.95)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.fontFamily = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
      el.innerHTML =
        '<div style="max-width:520px;padding:24px;text-align:center">' +
        '<div style="font-weight:600;font-size:16px;color:#111">Preview needs attention</div>' +
        '<div id="__paynto_preview_guard_detail__" style="margin-top:8px;font-size:12px;white-space:pre-wrap;color:#555"></div>' +
        '</div>';
      document.body.appendChild(el);
      return el;
    };

    const show = (detail) => {
      try {
        ensureOverlay();
        const d = document.getElementById('__paynto_preview_guard_detail__');
        if (d) d.textContent = detail || '';
      } catch {}
    };

    window.addEventListener('error', (e) => {
      const msg = safeString(e && (e.message || (e.error && e.error.message) || e.error));
      const stack = safeString(e && (e.error && e.error.stack));
      post('PAYNTO_SANDBOX_CLIENT_ERROR', { message: msg, stack: stack && stack.slice(0, 1200) });
      show(msg);
    });

    window.addEventListener('unhandledrejection', (e) => {
      const reason = e && e.reason;
      const msg = safeString(reason);
      const stack = safeString(reason && reason.stack);
      post('PAYNTO_SANDBOX_CLIENT_REJECTION', { message: msg, stack: stack && stack.slice(0, 1200) });
      show(msg);
    });

    // Useful for detecting "blank but no error": tells the parent when #root gets content.
    const observeRoot = () => {
      try {
        const root = document.getElementById('root');
        if (!root) return;
        let sent = false;
        const obs = new MutationObserver(() => {
          if (sent) return;
          if (root.childNodes && root.childNodes.length > 0) {
            sent = true;
            post('PAYNTO_SANDBOX_ROOT_RENDERED', { childCount: root.childNodes.length });
            try { obs.disconnect(); } catch {}
          }
        });
        obs.observe(root, { childList: true, subtree: true });
      } catch {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeRoot);
    else observeRoot();

    post('PAYNTO_SANDBOX_GUARD_READY', { href: location && location.href ? String(location.href).slice(0, 200) : '' });
  } catch {}
})();
</script>`;
}

export function patchViteIndexHtmlWithPreviewGuard(html: string): { patched: string; changed: boolean } {
  const src = String(html || '');
  if (!src) return { patched: src, changed: false };
  if (src.includes(MARKER)) return { patched: src, changed: false };

  const injection = buildInjectionScript();

  // Insert before </body> when possible; otherwise append.
  if (/<\/body\s*>/i.test(src)) {
    const patched = src.replace(/<\/body\s*>/i, `${injection}\n</body>`);
    return { patched, changed: patched !== src };
  }

  return { patched: `${src}\n${injection}\n`, changed: true };
}

export async function ensureSandboxPreviewGuardInjected(args: {
  provider: SandboxProvider;
}): Promise<{ changed: boolean; error?: string }> {
  try {
    const html = await args.provider.readFile('index.html');
    const { patched, changed } = patchViteIndexHtmlWithPreviewGuard(html);
    if (!changed) return { changed: false };
    await args.provider.writeFile('index.html', patched);
    return { changed: true };
  } catch (e: any) {
    return { changed: false, error: String(e?.message || e) };
  }
}

