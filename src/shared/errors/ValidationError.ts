import { AppError } from './AppError.js';

export interface FieldError {
  field: string;
  message: string;
}

export class ValidationError extends AppError {
  constructor(fields: FieldError[]) {
    super('Request validation failed', 422, 'VALIDATION_ERROR', fields);
  }
}
