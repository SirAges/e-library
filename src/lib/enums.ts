export enum Roles {
  STUDENT = "STUDENT",
  ADMIN = "ADMIN",
  LIBRARIAN = "LIBRARIAN",
}

export enum StudentStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum BorrowStatus {
  APPROVED = "APPROVED",
  PENDING = "PENDING",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  RETURNED = "RETURNED",
  COLLECTED = "COLLECTED",
}

export enum BookStatus {
  AVAILABLE = "AVAILABLE",
  CHECKED_OUT = "CHECKED_OUT",
  RESERVED = "RESERVED",
  LOST = "LOST",
}

export enum ErrorName {
  JsonWebTokenError = "JsonWebTokenError",
  TokenExpiredError = "TokenExpiredError",
  NotFound = "Not Found",
  FileUploadError = "File Upload Error",
}

export enum AppType {
  production = "production",
  development = "development",
}
