import { NextResponse } from "next/server"

export function projectRequestReviewSchemaError(error: unknown): NextResponse | null {
  if (typeof error !== "object" || error === null) return null
  const code = "code" in error && typeof error.code === "string" ? error.code : ""
  const message = "message" in error && typeof error.message === "string" ? error.message : ""
  const missingReviewColumn = code === "ER_BAD_FIELD_ERROR" &&
    /unknown column '(?:review_status|owner_message|reviewed_by|reviewed_at)'/i.test(message)
  const schemaPermissionError = [
    "ER_DBACCESS_DENIED_ERROR",
    "ER_TABLEACCESS_DENIED_ERROR",
    "ER_COLUMNACCESS_DENIED_ERROR",
  ].includes(code)

  if (!missingReviewColumn && !schemaPermissionError) return null

  return NextResponse.json(
    {
      error: schemaPermissionError
        ? "The database account cannot add the project review fields. Apply database/migrations/011_project_request_review_workflow.sql with a database administrator, then retry."
        : "The project request review fields are missing. Apply database/migrations/011_project_request_review_workflow.sql, then retry.",
    },
    { status: 503 },
  )
}
