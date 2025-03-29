# Middlewares

This section of the project contains all the middlewares of the application.

## Available Middleware

-   **Auth Middleware**

This middleware ensures user is properly authenticated and authorized before performing some actions.

    => only authenticated and authorized users can borrow books.

-   **Error Middleware**

This middleware handles all errors in our application gracefully and sends the user a friendly message. 
   
    => Message: You do not have the required access to the data you requested

-   **Rate Limit Middleware**

This middleware handles all request that exceed our request limit in our application gracefully and sends the user a friendly message. 
   
    => Message: Too many requests. Please try again later.

-   **Upload  Middleware**

This middleware handles all request contains a file in our application. 
   
