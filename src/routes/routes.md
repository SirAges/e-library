# Routes

This section of the project contains all the controllers of the application

## Available Routes

-   **Auth Routes**

exports all controllers required for authentication
   
    => sign in  [POST, /auth/sign-in]
    
    => sign up  [POST, /auth/sign-up]

    => sign out  [POST, /auth/sign-out]
    
    => verify otp   [POST, /auth/verify-otp]
    
    => refresh token    [POST, /auth/refresh-token]
    
    => forgotten password   [POST, /auth/forgot-password]
    

-   **Users Routes**

exports all controllers required to manage users 
    
    => get all users    [GET, /users/]
    
    => get details about a single user  [GET, /users/:userId]
    
    => update a user    [PUT, /users/:userId]
    
    => delete a user    [DELETE, /users/:userId]
    
    => get user statistics  [GET, /users/statistics/all]
    

-   **Books Routes**

exports all controllers required to manage users
    
    => create a book    [POST, /books]
    
    => get all books    [GET, /books]
    
    => get a single book    [GET, /books/:userId]
    
    => update a book    [PUT, /books/:userId]
    
    => delete a book    [DELETE, /books/:userId]
    
    => get books statistics [GET, /books/statistics/all]
    

-   **Borrow Routes**

exports all controllers required to manage users

    => borrow a book    [POST, /borrows/]

    => get all borrowed books   [GET, /borrows/]

    => get user borrowed books  [GET, /borrows/users/:userId]

    => get details about a borrowed book    [GET, /borrows/borrowId]

    => update a book in borrowed books  [PUT, /borrows/borrowId]

    => delete book from borrowed books  [DELETE, /borrows/borrowId]

    => get statistics for all borrowed books    [GET, /borrows/statistics/all]

    => cancel borrowed book [PUT, /borrows/borrowId/user/userId]

-   **Review Routes**

exports all controllers required to manage review

    => get all reviews   [GET, /reviews]

    => get a review [GET, /reviews/reviewId]

    => get reviews for a book   [GET, /reviews/bookId]

    => update a review  [GET, /reviews/reviewId]

    => delete review    [GET, /reviews/reviewId]

    => get statistics for all reviews   [GET, /reviews/statistics/all]
