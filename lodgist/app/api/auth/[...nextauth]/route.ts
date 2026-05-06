// Next.js App Router route handlers for NextAuth.js
// Using lazy dynamic import to avoid issues during build-time module evaluation
// where NextAuth may not have initialized its handlers yet.

type NextAuthHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response>;

let cachedHandlers: { GET: NextAuthHandler; POST: NextAuthHandler } | null = null;

async function getHandlers(): Promise<{ GET: NextAuthHandler; POST: NextAuthHandler }> {
  if (!cachedHandlers) {
    const auth = await import("@/auth");
    cachedHandlers = auth.handlers as { GET: NextAuthHandler; POST: NextAuthHandler };
  }
  return cachedHandlers;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string | string[]>> }
): Promise<Response> {
  const h = await getHandlers();
  return h.GET(req, ctx);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string | string[]>> }
): Promise<Response> {
  const h = await getHandlers();
  return h.POST(req, ctx);
}
