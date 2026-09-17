import { createFileRoute } from "@tanstack/react-router";
import { PrideApp } from "@/components/pride-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <PrideApp />;
}
