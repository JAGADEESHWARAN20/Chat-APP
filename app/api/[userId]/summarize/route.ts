// import { NextRequest, NextResponse } from "next/server";
// import { z } from "zod";
// import OpenAI from "openai";
// import { v4 as uuidv4 } from "uuid";
// import { createClient } from "@supabase/supabase-js";
// import type { Database } from "@/lib/types/supabase";
// import { ensureSystemUserExists } from "@/lib/init/systemUser";

// // ---------------- Schema ----------------
// const SummarizeSchema = z.object({
//   prompt: z.string().min(1).max(15000),
//   roomId: z.string().min(1),
//   userId: z.string().optional(),
//   model: z.string().default("openai/gpt-4o"),
// });

// // ---------------- Supabase Client ----------------
// const supabase = createClient<Database>(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// // ---------------- OpenAI (OpenRouter) ----------------
// const openai = new OpenAI({
//   baseURL: "https://openrouter.ai/api/v1",
//   apiKey: process.env.OPENROUTER_API_KEY!,
// });

// // ---------------- AI Response Parser ----------------
// function parseContent(raw: unknown): string {
//   if (!raw) return "No response received.";
//   if (typeof raw === "string") return raw;
//   if (Array.isArray(raw)) {
//     return raw
//       .map((item) => {
//         if (typeof item === "string") return item;
//         if (item?.type === "text") return item.content ?? "";
//         if (item?.type === "image_url") return "[Image omitted]";
//         return "";
//       })
//       .join(" ")
//       .trim();
//   }
//   return "Unsupported AI response format.";
// }

// // ---------------- MAIN HANDLER ----------------
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();
//     const { prompt, roomId, userId: rawUserId, model } =
//       SummarizeSchema.parse(body);

//     const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

//     const userId =
//       rawUserId && rawUserId.trim() !== "" && rawUserId !== "system"
//         ? rawUserId
//         : SYSTEM_USER_ID;

//     console.log("📨 Summarize Request:", { userId, roomId, model });

//     // Ensure system user exists in profiles
//     await ensureSystemUserExists();

//     // ---------------- AI GENERATION ----------------
//     const completion = await openai.chat.completions.create({
//       model,
//       messages: [
//         { role: "system", content: "You are a helpful, concise AI assistant." },
//         { role: "user", content: prompt },
//       ],
//     });

//     const message = completion.choices?.[0]?.message?.content ?? "";
//     const parsedContent = parseContent(message);

//     const tokenCount = completion?.usage?.total_tokens ?? 0;

//     // ---------------- PROFILE USER CHECK ----------------
//     const { data: profileExists } = await supabase
//       .from("profiles")
//       .select("id")
//       .eq("id", userId)
//       .maybeSingle();

//     if (!profileExists) {
//       console.log("⚠️ Profile missing. Creating:", userId);

//       await supabase.from("profiles").insert({
//         id: userId,
//         display_name: "Anonymous",
//         avatar_url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Guest",
//         created_at: new Date().toISOString(),
//       });
//     }

//     // ---------------- SAVE CHAT HISTORY ----------------
//     const insertPayload = {
//       id: uuidv4(),
//       room_id: roomId,
//       user_id: userId,
//       user_query: prompt,
//       ai_response: parsedContent,
//       model_used: model,
//       token_count: tokenCount,
//       message_count: 2,
//       analysis_type: "general",
//       structured_data: {},
//       created_at: new Date().toISOString(),
//       updated_at: new Date().toISOString(),
//     };

//     const { error: insertError } = await supabase
//       .from("ai_chat_history")
//       .insert(insertPayload);

//     if (insertError) {
//       console.error("❌ Supabase Insert Error:", insertError.message);
//       throw new Error(insertError.message);
//     }

//     console.log("✅ Chat Saved:", insertPayload);

//     return NextResponse.json({
//       success: true,
//       fullContent: parsedContent,
//       meta: { tokens: tokenCount, model },
//     });
//   } catch (err: any) {
//     console.error("💥 Summarize Error:", err);
//     return NextResponse.json(
//       { success: false, error: err.message ?? "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }



// // // app/api/[userId]/summarize/route.ts
// // import { NextRequest, NextResponse } from "next/server";
// // import { z } from "zod";
// // import { v4 as uuidv4 } from "uuid";
// // import OpenAI from "openai";
// // import { createClient } from "@supabase/supabase-js";
// // import type { Database } from "@/lib/types/supabase";
// // import { ensureSystemUserExists } from "@/lib/init/systemUser";

// // /**
// //  * NOTE:
// //  * - Keep Node runtime if you rely on node libs like @supabase/supabase-js.
// //  * - If you want streaming (SSE) later, you'll want to change approach and possibly use edge runtime.
// //  */

// // // -----------------------------
// // // Schema
// // // -----------------------------
// // const SummarizeSchema = z.object({
// //   prompt: z.string().min(1).max(15000),
// //   roomId: z.string().min(1),
// //   model: z.string().default("openai/gpt-4o"),
// // });

// // // -----------------------------
// // // Clients
// // // -----------------------------
// // const supabase = createClient<Database>(
// //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
// //   process.env.SUPABASE_SERVICE_ROLE_KEY!
// // );

// // const openai = new OpenAI({
// //   baseURL: "https://openrouter.ai/api/v1",
// //   apiKey: process.env.OPENROUTER_API_KEY!,
// // });

// // // -----------------------------
// // // Utils
// // // -----------------------------
// // function parseContent(raw: unknown): string {
// //   if (!raw) return "No response received.";
// //   if (typeof raw === "string") return raw;
// //   if (Array.isArray(raw)) {
// //     return raw
// //       .map((item) => {
// //         if (typeof item === "string") return item;
// //         if ((item as any)?.type === "text") return (item as any).content ?? "";
// //         if ((item as any)?.type === "image_url") return "[Image omitted]";
// //         return "";
// //       })
// //       .join(" ")
// //       .trim();
// //   }
// //   // some SDKs return objects with { message: { content: "..." } } etc.
// //   if ((raw as any)?.message?.content) return (raw as any).message.content;
// //   return "Unsupported AI response format.";
// // }

// // // small helper to race a promise against a timeout
// // function withTimeout<T>(promise: Promise<T>, ms: number, err = new Error("timeout")) {
// //   return Promise.race([
// //     promise,
// //     new Promise<T>((_, reject) => setTimeout(() => reject(err), ms)),
// //   ]);
// // }

// // // -----------------------------
// // // Route handler
// // // -----------------------------
// // export async function POST(
// //   req: NextRequest,
// //   { params }: { params: { userId?: string } }
// // ) {
// //   try {
// //     // parse & validate body
// //     const body = await req.json().catch(() => null);
// //     if (!body) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });

// //     const parsed = SummarizeSchema.safeParse(body);
// //     if (!parsed.success) {
// //       return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
// //     }

// //     const { prompt, roomId, model } = parsed.data;

// //     // choose user id from route param; fallback to system user
// //     const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
// //     const rawUserId = params?.userId;
// //     const userId = rawUserId && rawUserId.trim() !== "" && rawUserId !== "system" ? rawUserId : SYSTEM_USER_ID;

// //     console.log("📨 [Summarize Request]", { model, userId, roomId });

// //     // ensure system user exists (idempotent)
// //     try {
// //       await ensureSystemUserExists();
// //     } catch (e) {
// //       console.warn("ensureSystemUserExists failed:", e);
// //       // not fatal
// //     }

// //     // ensure user row exists (create placeholder if missing) - this prevents FK 'user not found' errors
// //     try {
// //       const { data: maybeUser, error: selErr } = await supabase
// //         .from("users")
// //         .select("id")
// //         .eq("id", userId)
// //         .maybeSingle();

// //       if (selErr) {
// //         console.warn("supabase select user error (non-fatal):", selErr);
// //       }

// //       if (!maybeUser) {
// //         // create placeholder user (no throw — we continue even if insert fails)
// //         const placeholder = {
// //           id: userId,
// //           username: "guest_user",
// //           display_name: userId === SYSTEM_USER_ID ? "System AI Assistant" : "Anonymous User",
// //           avatar_url:
// //             userId === SYSTEM_USER_ID
// //               ? "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=SystemBot"
// //               : "https://api.dicebear.com/9.x/thumbs/svg?seed=Guest",
// //           created_at: new Date().toISOString(),
// //         };
// //         const { error: upsertErr } = await supabase.from("users").insert(placeholder);
// //         if (upsertErr) {
// //           console.warn("Failed to create placeholder user (non-fatal):", upsertErr);
// //         } else {
// //           console.log("👤 Created placeholder user:", userId);
// //         }
// //       }
// //     } catch (e) {
// //       console.warn("User existence check/create failed (non-fatal):", e);
// //     }

// //     // -----------------------------
// //     // Call OpenRouter/OpenAI with abort timeout (protects serverless timeouts)
// //     // -----------------------------
// //     // Abort after 15s if model is slow
// //     const ABORT_MS = 15000;
// //     const controller = new AbortController();
// //     const timeout = setTimeout(() => controller.abort(), ABORT_MS);

// //     let aiContent = "";
// //     try {
// //       const completionPromise = openai.chat.completions.create({
// //         model,
// //         messages: [
// //           { role: "system", content: "You are a concise, helpful AI summarizer." },
// //           { role: "user", content: prompt },
// //         ],
// //         // If openai sdk supports signal in options, pass it here. The 'openai' library may accept a fetch signal depending on version.
// //         // @ts-ignore
// //         signal: controller.signal,
// //       });

// //       // wrap in withTimeout in case the SDK doesn't honor AbortController fully
// //       const completion = await withTimeout(completionPromise as Promise<any>, ABORT_MS + 1000, new Error("AI request timed out"));

// //       // parse content safely
// //       aiContent = parseContent((completion as any)?.choices?.[0]?.message?.content ?? "");
// //     } catch (aiErr: any) {
// //       console.error("AI request failed:", aiErr?.message ?? aiErr);
// //       // map abort -> 504-like friendly message
// //       if (aiErr?.name === "AbortError" || (aiErr?.message && aiErr.message.toLowerCase().includes("timeout"))) {
// //         clearTimeout(timeout);
// //         return NextResponse.json({ success: false, error: "AI request timed out" }, { status: 504 });
// //       }
// //       clearTimeout(timeout);
// //       return NextResponse.json({ success: false, error: aiErr?.message || "AI request failed" }, { status: 502 });
// //     } finally {
// //       clearTimeout(timeout);
// //     }

// //     // -----------------------------
// //     // Save result to DB but do not let a slow DB block the response for too long.
// //     // We'll attempt the insert but race it against a short timeout (3s).
// //     // -----------------------------
// //     const insertData = {
// //       id: uuidv4(),
// //       room_id: roomId,
// //       user_id: userId,
// //       user_query: prompt,
// //       ai_response: aiContent,
// //       model_used: model,
// //       created_at: new Date().toISOString(),
// //     } satisfies Database["public"]["Tables"]["ai_chat_history"]["Insert"];

// //     try {
// //         // Convert Supabase's thenable to a real Promise
// //         const insertTask = Promise.resolve(
// //           supabase.from("ai_chat_history").insert(insertData)
// //         );
      
// //         await withTimeout(insertTask, 3000);
// //         console.log("✅ AI result saved to DB (or attempted).");
// //       } catch (dbErr) {
// //         console.warn("⚠️ DB insert slow/failed (non-fatal):", dbErr);
// //       }
      

// //     // -----------------------------
// //     // Return AI result to client
// //     // -----------------------------
// //     return NextResponse.json({ success: true, fullContent: aiContent });
// //   } catch (err: unknown) {
// //     console.error("Unhandled summarize error:", err);
// //     const message =
// //       err instanceof Error ? err.message : typeof err === "string" ? err : "Internal Server Error";
// //     return NextResponse.json({ success: false, error: message }, { status: 500 });
// //   }
// // }
