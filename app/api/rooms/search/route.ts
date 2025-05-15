import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Import the Database type from the updated type definitions
import { Database } from "@/lib/types/supabase";

export async function GET(req: NextRequest) {
     // Initialize Supabase client with type safety
     const supabase = createRouteHandlerClient<Database>({ cookies });

     // Check authentication
     console.log("[Rooms Search] Checking authentication");
     const { data: { session } } = await supabase.auth.getSession();
     if (!session) {
          console.error("[Rooms Search] Unauthorized access");
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }
     console.log("[Rooms Search] Authentication successful, userId:", session.user.id);

     const userId = session.user.id;

     // Get query parameters
     const query = req.nextUrl.searchParams.get("query");
     const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10", 10);
     const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
     const includePrivate = req.nextUrl.searchParams.get("includePrivate") === "true";

     // Validate query parameters
     console.log("[Rooms Search] Validating query parameters:", { query, limit, offset, includePrivate });
     if (!query || typeof query !== "string" || query.trim() === "") {
          console.error("[Rooms Search] Search query is required");
          return NextResponse.json({ error: "Search query is required" }, { status: 400 });
     }

     if (isNaN(limit) || limit < 1 || limit > 50) {
          console.error("[Rooms Search] Invalid limit parameter");
          return NextResponse.json({ error: "Invalid limit parameter (must be 1-50)" }, { status: 400 });
     }

     if (isNaN(offset) || offset < 0) {
          console.error("[Rooms Search] Invalid offset parameter");
          return NextResponse.json({ error: "Invalid offset parameter (must be non-negative)" }, { status: 400 });
     }

     const trimmedQuery = query.trim();
     console.log("[Rooms Search] Trimmed query:", trimmedQuery);

     try {
          // Build the query to fetch rooms
          console.log("[Rooms Search] Fetching rooms with query:", trimmedQuery);
          const supabaseQuery = supabase
               .from("rooms")
               .select("id, name, is_private, created_by, created_at", { count: "exact" })
               .ilike("name", `%${trimmedQuery}%`)
               .order("created_at", { ascending: false })
               .range(offset, offset + limit - 1);

          // Apply filter for public/private rooms
          if (!includePrivate) {
               console.log("[Rooms Search] Filtering out private rooms");
               supabaseQuery.eq("is_private", false);
          }

          const { data: rooms, error: roomsError, count } = await supabaseQuery;

          if (roomsError) {
               console.error("[Rooms Search] Supabase Query Error:", roomsError);
               return NextResponse.json({ error: "Failed to search rooms" }, { status: 500 });
          }
          console.log("[Rooms Search] Rooms fetched successfully:", { count, rooms });

          // Batch check membership for all rooms
          const roomIds = rooms.map((room) => room.id);
          console.log("[Rooms Search] Fetching memberships for rooms:", roomIds);
          const { data: memberships, error: membershipError } = await supabase
               .from("room_members")
               .select("room_id, status")
               .in("room_id", roomIds)
               .eq("user_id", userId)
               .eq("status", "accepted");

          if (membershipError) {
               console.error("[Rooms Search] Error fetching memberships:", membershipError);
               return NextResponse.json(
                    { error: "Failed to fetch memberships" },
                    { status: 500 }
               );
          }
          console.log("[Rooms Search] Memberships fetched:", memberships);

          // Create a membership map
          const membershipMap: { [key: string]: boolean } = {};
          roomIds.forEach((roomId) => {
               membershipMap[roomId] = false; // Default to false
          });
          memberships.forEach((membership) => {
               if (membership.status === "accepted") {
                    membershipMap[membership.room_id] = true;
               }
          });
          console.log("[Rooms Search] Membership map created:", membershipMap);

          // Add isMember to each room
          const roomsWithMembership = rooms.map((room) => ({
               ...room,
               isMember: membershipMap[room.id] || false,
          }));

          // Log results for debugging
          console.log("[Rooms Search] Search Results:", { rooms: roomsWithMembership, total: count });

          // Return results with pagination metadata
          return NextResponse.json({
               rooms: roomsWithMembership || [],
               total: count || 0,
               limit,
               offset,
          });
     } catch (err) {
          console.error("[Rooms Search] Error:", err);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
     }
}