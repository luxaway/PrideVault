import { createFileRoute } from "@tanstack/react-router";
import { startXWriteOAuth } from "@/lib/x-write.server";

export const Route = createFileRoute("/api/x/start")({
  server: {
    handlers: {
      GET: ({ request }) => startXWriteOAuth(request),
    },
  },
});
