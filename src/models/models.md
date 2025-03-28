# Models

This section of the project contains all the controllers of the application

## Available Models

-   **User Model**

This model defines the structure of each user in the database
below are the fields
   
    =>  id
    
    =>  email
    
    =>  password
    
    =>  lastName
    
    =>  firstName

    =>  idCard
    
    =>  status [ ACTIVE, INACTIVE, SUSPENDED]
    
    =>  role [ STUDENT, LIBRARIAN, ADMIN]
    
    =>  studentBorrows  [List of student borrowed books]

    =>  librarianBorrows  [List of librarian approved boorowed book]
    

-   **Borrow Model**

This model defines the structure of each borrowed book in the database
below are the fields
   
    =>  id
    
    =>  userId

    =>  bookId
    
    =>  borrowDate
    
    =>  returnDate
    
    =>  status
    
    =>  librarianId [Librarian that approved the borrow]
    

-   **Books Models**

This model defines the structure of each book in the database
    

    =>  id
    
    =>  title
    
    =>  isbn
    
    =>  author
    
    =>  publisher
    
    =>  year
    
    =>  edition
    
    =>  language
    
    =>  status [ AVAILABLE, CHECKED_OUT, RESERVED,LOST]
    
    =>  borrowCount
    
    =>  category
    
    =>  copies
    
    =>  availableCopies
    
    =>  description
    
    =>  coverUrl
    
    =>  ebookUrl
    
    =>  summary
    
    =>  color
    
    =>  videoUrl
    
    =>  callNumber
    

-   **Review Model**

This model defines the structure of each book review book in the database
below are the fields
   
    =>  id
    
    =>  bookId
    
    =>  rating
    
    =>  comment
    