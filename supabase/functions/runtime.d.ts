// Minimal host surface used by our Edge entrypoints; application/provider types come from pinned npm packages.
declare const Deno: {
  env: { toObject(): Record<string, string>; get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): unknown
  readFile(path: string | URL): Promise<Uint8Array>
  readTextFile(path: string | URL): Promise<string>
}
