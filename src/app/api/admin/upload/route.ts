import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdminAuthed } from "@/lib/admin-api-auth";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * The @vercel/blob client's `upload()` helper discards whatever this route
 * returns on failure and always throws a generic "Failed to retrieve the
 * client token" (see retrieveClientToken in @vercel/blob/dist/client.js) —
 * so a POST failure here can never reach the admin with a useful message.
 * The image-upload-field component instead calls this GET first and shows
 * the real cause before ever attempting the SDK's upload() call.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  return NextResponse.json({ configured });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        if (!(await isAdminAuthed())) {
          throw new Error("Non autorisé.");
        }
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new Error(
            "Stockage d'images non configuré (BLOB_READ_WRITE_TOKEN manquant)."
          );
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_SIZE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    // Note: @vercel/blob's client upload() helper discards this response's
    // body on failure (see the GET handler's comment above) — this message
    // is only ever seen by a caller that reads the response itself.
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors du téléversement de l'image.",
      },
      { status: 400 }
    );
  }
}
