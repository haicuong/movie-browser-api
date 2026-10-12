let port = Number(process.env.PORT);

if (isNaN(port) || port <= 0 || port > 65535 || !Number.isInteger(port)) {
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  ) {
    port ??= 3000;
  } else throw new Error("Invalid PORT value");
}

if (!process.env.PORT || !process.env.NODE_ENV) {
  throw new Error("Missing required environment variables");
} else if (
  !["development", "production", "test"].includes(process.env.NODE_ENV)
) {
  throw new Error("Invalid NODE_ENV value");
}

const env = {
  port: port,
  nodeEnv: process.env.NODE_ENV,
};

export default env;
