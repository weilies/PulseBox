import { getUser } from "@/lib/auth";

/**
 * GET /api/auth/me — Returns the current user's ID and email.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ id: user.id, email: user.email });
}
