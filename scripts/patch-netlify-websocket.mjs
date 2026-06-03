import { readFileSync, writeFileSync } from "node:fs";

const apiPath = new URL("../netlify/functions/api.ts", import.meta.url);
let source = readFileSync(apiPath, "utf8");

if (!source.includes('import { WebSocket as NodeWebSocket } from "ws";')) {
  source = source.replace(
    'import { createClient } from "@supabase/supabase-js";',
    'import { createClient } from "@supabase/supabase-js";\nimport { WebSocket as NodeWebSocket } from "ws";'
  );
}

source = source.replace(
  'return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false\n    }\n  });',
  'return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SECRET_KEY"), {\n    auth: {\n      persistSession: false,\n      autoRefreshToken: false\n    },\n    realtime: {\n      transport: NodeWebSocket as never\n    }\n  });'
);

writeFileSync(apiPath, source);
