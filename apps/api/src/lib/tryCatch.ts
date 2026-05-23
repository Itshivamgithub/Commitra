import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * A higher-order function that wraps an async Express request handler
 * and routes any thrown errors or rejected promises to the next error middleware.
 */
export const tryCatch = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
export default tryCatch;
