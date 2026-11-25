import { createFileRoute } from "@tanstack/react-router";
import {
  REVIEW_FILE_NAME,
  isExplainEditorEnabled,
  reviewFilePath,
  reviewProgress,
  saveOneReview,
} from "@/server/explainReviews";

export const Route = createFileRoute("/api/explain-review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const enabled = isExplainEditorEnabled(request);
        const stats = enabled ? await reviewProgress() : { total: 0, revised: 0 };
        return Response.json(
          {
            enabled,
            total: stats.total,
            revised: stats.revised,
            fileName: REVIEW_FILE_NAME,
            filePath: enabled ? reviewFilePath() : "",
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          pointId?: string;
          say?: string;
          bookName?: string;
          reason?: string;
        };
        const result = await saveOneReview(body, request);
        if (!result.ok) {
          return Response.json({ success: false, error: result.error }, { status: result.status });
        }
        return Response.json({
          success: true,
          review: result.review,
          total: result.stats.total,
          revised: result.stats.revised,
        });
      },
    },
  },
});
