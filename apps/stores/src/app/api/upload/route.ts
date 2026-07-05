import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // The proxy matcher exempts /api, so this handler must enforce auth itself.
    // Without this, anyone on the LAN could write files into public/uploads.
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const phase = formData.get("phase")?.toString() || "RECEIPT";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Ensure public/uploads exists
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const savedUrls: { url: string; type: string }[] = [];

    for (const file of files) {
      // Validate file size or empty files
      if (!file.name || file.size === 0) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate a unique filename using built-in crypto.randomUUID
      const uniqueId = crypto.randomUUID();
      const fileParts = file.name.split(".");
      const ext = fileParts.length > 1 ? fileParts.pop() : "bin";
      const filename = `${phase.toLowerCase()}_${uniqueId}.${ext}`;
      const filePath = join(uploadDir, filename);

      await writeFile(filePath, buffer);

      // Determine type based on MIME type or file extension
      let type = "IMAGE";
      if (file.type.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi"].includes(ext?.toLowerCase() || "")) {
        type = "VIDEO";
      }

      savedUrls.push({
        url: `/uploads/${filename}`,
        type,
      });
    }

    return NextResponse.json({ success: true, files: savedUrls });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
