const path = require("path");

module.exports = (options, webpack) => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    ...options,
    optimization: {
      ...options.optimization,
      minimize: isProduction, // Só minifica em produção
      removeAvailableModules: true,
      removeEmptyChunks: true,
      mergeDuplicateChunks: true,
    },
    plugins: [...options.plugins],
    resolve: {
      ...options.resolve,
      alias: {
        "@src": path.resolve(__dirname, "../src"),
        "@libs": path.resolve(__dirname, "../libs"),
        "@core": path.resolve(__dirname, "../src/core"),
        "@supporting": path.resolve(__dirname, "../src/supporting"),
        "@generic": path.resolve(__dirname, "../src/generic"),
        "@shared": path.resolve(__dirname, "../src/shared"),
      },
    },
  };
};
