import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404, 'RESOURCE_NOT_FOUND');
  }
}
