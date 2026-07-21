export function errorHandler(err, _req, res, _next) {
  console.error(err);
  
  let status = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Clean up Prisma error messages so they are not massive raw blocks in the UI
  if (
    err.name === "PrismaClientValidationError" || 
    err.name === "PrismaClientKnownRequestError" ||
    err.name === "PrismaClientInitializationError"
  ) {
    status = 400;
    
    // Prisma errors are often multi-line with the actual useful message at the very end
    const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      message = lines[lines.length - 1];
    } else {
      message = "Database operation failed";
    }

    // Strip ANSI color codes just in case Prisma includes them
    message = message.replace(/\x1b\[[0-9;]*m/g, "");
  }

  res.status(status).json({ error: message });
}
