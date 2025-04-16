import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Application } from "express";

const setupSwagger = (app: Application) => {
  const pathToDocs = path.join(__dirname, "../../public/docs");
  const swaggerDocument = YAML.load(path.join(pathToDocs, "/swagger.yaml"));
  const authDocument = YAML.load(path.join(pathToDocs, "/auth.yaml"));
  const usersDocument = YAML.load(path.join(pathToDocs, "/user.yaml"));
  const booksDocument = YAML.load(path.join(pathToDocs, "/book.yaml"));
  const reviewsDocument = YAML.load(path.join(pathToDocs, "/borrow.yaml"));
  const borrowsDocument = YAML.load(path.join(pathToDocs, "/review.yaml"));

 swaggerDocument.paths = {
    ...swaggerDocument.paths, 
    ...(authDocument.paths || {}), 
    ...(usersDocument.paths || {}), // Users-specific paths (optional)
    ...(booksDocument.paths || {}), // Books-specific paths (optional)
    ...(borrowsDocument.paths || {}), // Borrows-specific paths (optional)
    ...(reviewsDocument.paths || {}), // Review-specific paths (optional)
  };

  // Set up Swagger UI to serve documentation
  app.use(
    "/api/v1/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customCssUrl: path.join(pathToDocs, "/docs/style.css"),
      customSiteTitle:"Readora Api Docs"
    })
  );
};

export default setupSwagger;

