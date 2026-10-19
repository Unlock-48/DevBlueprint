export function GET() {
  return Response.json({
    status: "ok",
    service: "devblueprint",
    timestamp: new Date().toISOString(),
  });
}
