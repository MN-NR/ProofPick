const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";

/** Browser calls stay same-origin, so the session cookie and API keys never cross to the client. */
export default {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};
