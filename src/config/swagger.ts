import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Application } from "express";

const setupSwagger = (app: Application) => {
  // Load the main Swagger document and additional YAML files
  const swaggerDocument = YAML.load(
    path.join(__dirname, "../docs/swagger.yaml")
  );
  const authDocument = YAML.load(path.join(__dirname, "../docs/auth.yaml"));
  const usersDocument = YAML.load(path.join(__dirname, "../docs/user.yaml"));
  const booksDocument = YAML.load(path.join(__dirname, "../docs/book.yaml"));
  const reviewsDocument = YAML.load(
    path.join(__dirname, "../docs/borrow.yaml")
  );
  const borrowsDocument = YAML.load(
    path.join(__dirname, "../docs/review.yaml")
  );

  // Combine paths, ensure you're not overwriting any existing path definitions
  // If paths overlap, the later file will override the earlier one
  swaggerDocument.paths = {
    ...swaggerDocument.paths, // Main paths
    ...(authDocument.paths || {}), // Auth-specific paths (optional)
    ...(usersDocument.paths || {}), // Users-specific paths (optional)
    ...(booksDocument.paths || {}), // Books-specific paths (optional)
    ...(borrowsDocument.paths || {}), // Borrows-specific paths (optional)
    ...(reviewsDocument.paths || {}), // Review-specific paths (optional)
  };



  // Set up Swagger UI to serve documentation
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, { customCssUrl: "../docs/style.css" })
  );
};

export default setupSwagger;
