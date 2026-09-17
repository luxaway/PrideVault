import { Buffer } from "buffer";

const g = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
};

function installProcess() {
  const current = (globalThis as unknown as { process?: Record<string, unknown> }).process;
  const existing = current && typeof current === "object" ? current : {};
  const env =
    existing.env && typeof existing.env === "object"
      ? (existing.env as Record<string, string | undefined>)
      : {};
  if (!env.NODE_ENV) env.NODE_ENV = "production";
  (globalThis as unknown as { process: Record<string, unknown> }).process = {
    ...existing,
    env,
    browser: true,
    version: existing.version || "",
    versions: existing.versions || { node: "" },
    pid: existing.pid ?? 0,
    platform: existing.platform || "browser",
    stdout: existing.stdout || { isTTY: false, write: () => true },
    stderr: existing.stderr || { write: () => true },
    cwd: existing.cwd || (() => "/"),
    nextTick:
      existing.nextTick ||
      ((cb: (...args: unknown[]) => void, ...args: unknown[]) => {
        queueMicrotask(() => cb(...args));
      }),
  };
}

if (!g.global) g.global = g;
if (!g.Buffer) g.Buffer = Buffer;
installProcess();

/** Inline classic script — runs before any ES module so `process` exists. */
export const PROCESS_SHIM = `!function(){var g=typeof globalThis!="undefined"?globalThis:window;if(!g.global)g.global=g;var p=g.process&&typeof g.process=="object"?g.process:{};p.env=p.env&&typeof p.env=="object"?p.env:{};if(!p.env.NODE_ENV)p.env.NODE_ENV="production";p.browser=!0;p.pid=p.pid||0;p.platform=p.platform||"browser";p.stdout=p.stdout||{isTTY:!1,write:function(){return!0}};p.stderr=p.stderr||{write:function(){return!0}};p.cwd=p.cwd||function(){return"/"};p.nextTick=p.nextTick||function(c){var a=[].slice.call(arguments,1);queueMicrotask(function(){c.apply(null,a)})};p.version=p.version||"";p.versions=p.versions||{node:""};g.process=p;}();`;
