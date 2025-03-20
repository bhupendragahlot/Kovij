// src/middleware/cacheMiddleware.js
import NodeCache from "node-cache";

// Create a cache instance with a standard TTL of 60 seconds
const cache = new NodeCache({ stdTTL: 60 });

export const cacheMiddleware = (req, res, next) => {
  const key = req.originalUrl;

  // Check if the response for this route is cached
  const cachedResponse = cache.get(key);
  if (cachedResponse) {
    return res.json(cachedResponse);
  } else {
    // Capture the original res.json method
    res.sendResponse = res.json;
    res.json = (body) => {
      cache.set(key, body);
      res.sendResponse(body);
    };
    next();
  }
};
