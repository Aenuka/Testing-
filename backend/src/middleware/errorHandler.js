export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  if (err.code === 11000) { status = 409; message = 'A record with that email or SKU already exists'; }
  if (err.name === 'ValidationError' || err.name === 'CastError') { status = 400; message = 'Please provide valid values for every field'; }
  if (status >= 500) { console.error(err); message = 'Something went wrong. Please try again'; }
  res.status(status).json({ message });
}
