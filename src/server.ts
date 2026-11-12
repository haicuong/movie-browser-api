import app from "./app.js";
import env from "./config/env.js";

app.listen(env.port, (error) => {
  if (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
  console.log(`Server is running on port ${env.port} in ${env.nodeEnv} mode.`);
});
