import { NextRequest } from 'next/server';
import { buildRunManager } from '@/lib/build-orchestrator/run-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = buildRunManager.getRun(runId);

  if (!run) {
    return new Response('Run not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (evt: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      // Replay existing events so refresh/resume is consistent.
      for (const evt of buildRunManager.listEvents(runId)) {
        send(evt);
      }

      const unsubscribe = buildRunManager.subscribe(runId, send);

      // Keepalive ping to avoid intermediaries closing the stream.
      const pingId = setInterval(() => {
        send({ type: 'ping', runId, at: Date.now() });
      }, 15000);

      const abort = () => {
        clearInterval(pingId);
        try {
          unsubscribe();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      // Close on client disconnect
      request.signal.addEventListener('abort', abort);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

