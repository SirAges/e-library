

declare interface CloudinaryFile {
  secure_url: string;
  format: string;
  bytes: number;
  public_id: string;
}

enum BorrowStatus {
  PENDING,
  APPROVED,
  REJECTED,
  CANCELLED,
  RETURNED,
  COLLECTED,
}

declare interface User {
  email: string;
  password: string;
  lastName: string;
  firstName: string;
  idCardUrl: CloudinaryFile;
}
declare interface Book {
  title: string;
  isbn: string;
  author: string;
  publisher: string;
  edition: string;
  language: string;
  category: string;
  status: BookStatus;
  year: number;
  copies: number;
  availableCopies: number;
  borrowCount: number;
  description: string;
  coverUrl: CloudinaryFile;
  ebookUrl: CloudinaryFile;
  summary: string;
  color: string;
  videoUrl: CloudinaryFile;
  callNumber: string;
}
declare interface Borrow {
  bookId: number;
  borrowDate: Date;
  status: BorrowStatus;
}
declare interface Review {
  rating: number;
  comment: String;
}
declare interface SendEmail {
  to: string;
  subject: string;
  html: string;
}