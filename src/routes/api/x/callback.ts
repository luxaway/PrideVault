import { createFileRoute } from "@tanstack/react-router";
import { finishXWriteOAuth } from "@/lib/x-write.server";

export const Route = createFileRoute("/api/x/callback")({
  server: {
    handlers: {
      GET: ({ request }) => finishXWriteOAuth(request),
    },
  },
});
